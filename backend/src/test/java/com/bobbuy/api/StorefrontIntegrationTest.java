package com.bobbuy.api;

import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.service.*;
import com.fasterxml.jackson.databind.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.web.servlet.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class StorefrontIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired BobbuyStore store;
    @Autowired UserRepository users;
    @Autowired TripRepository trips;
    @Autowired ProductRepository products;
    @Autowired OrderHeaderRepository orders;
    @Autowired EmailChallengeRepository challenges;
    @Autowired RefreshTokenSessionRepository refreshSessions;
    @Autowired MerchantCustomerRepository relations;
    @Autowired ProductSaleService sales;
    @MockBean JavaMailSender mail;

    @BeforeEach void setup() {
        refreshSessions.deleteAllInBatch(); challenges.deleteAll(); relations.deleteAll(); store.seed();
    }
    @AfterEach void cleanup() { refreshSessions.deleteAllInBatch(); challenges.deleteAll(); relations.deleteAll(); }

    JsonNode register(String name) throws Exception {
        return json.readTree(mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("username", name, "password", "valid-password", "email", name + "@example.com"))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.user.emailVerified").value(false))
            .andExpect(jsonPath("$.data.user.roles[0]").value("CUSTOMER")).andExpect(jsonPath("$.data.refreshToken").doesNotExist())
            .andReturn().getResponse().getContentAsString()).get("data");
    }
    String token(JsonNode registration) { return registration.get("accessToken").asText(); }
    void completeDelivery(JsonNode registration) throws Exception {
        mvc.perform(patch("/api/auth/profile").header("Authorization","Bearer "+token(registration)).contentType(MediaType.APPLICATION_JSON)
            .content("{\"defaultAddress\":{\"contactName\":\"Buyer\",\"countryRegion\":\"Japan\",\"city\":\"Tokyo\",\"addressLine\":\"Original street\"}}"))
            .andExpect(status().isOk());
    }
    String checkoutBody(UUID requestId, long tripId, String product, int quantity) throws Exception {
        String quote=products.findById(product).flatMap(sales::quote).map(ProductSaleService.Quote::priceToken).orElse("unavailable");
        return json.writeValueAsString(Map.of("requestId",requestId,"tripId",tripId,"items",List.of(Map.of("productId",product,"quantity",quantity,"priceToken",quote))));
    }
    ResultActions checkout(String token, String body) throws Exception {
        return mvc.perform(post("/api/checkout").header("Authorization","Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    @Test void publicCatalogExcludesDraftsAndPrivateFields() throws Exception {
        Trip draft = new Trip(9000L, 1000L, "Draft", LocalDate.now().plusDays(2), TripStatus.PUBLISHED, LocalDateTime.now());
        trips.save(draft);
        Product hidden = new Product(); hidden.setId("hidden"); hidden.setMerchantId(1000L); hidden.setName(Map.of("zh-CN","Hidden")); hidden.setVisibilityStatus(ProductVisibility.DRAFTER_ONLY); products.save(hidden);
        String tripJson = mvc.perform(get("/api/storefront/trips")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(tripJson).doesNotContain("Secret", "capacity", "reservedCapacity", "customerId");
        String catalog = mvc.perform(get("/api/storefront/products")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(catalog).contains("prd-1000").doesNotContain("hidden", "merchantSkus", "priceTiers");
        mvc.perform(post("/api/checkout").contentType(MediaType.APPLICATION_JSON).content(checkoutBody(UUID.randomUUID(),2000,"prd-1000",1))).andExpect(status().isUnauthorized());
    }

    @Test void unverifiedCheckoutUsesServerPriceAndIsIdempotent() throws Exception {
        JsonNode registration = register("guest_checkout");
        completeDelivery(registration);
        mvc.perform(get("/api/trips").header("Authorization","Bearer "+token(registration)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data").isEmpty());
        mvc.perform(get("/api/trips/2000").header("Authorization","Bearer "+token(registration)))
            .andExpect(status().isNotFound());
        mvc.perform(get("/api/mobile/products").header("Authorization","Bearer "+token(registration)))
            .andExpect(status().isForbidden());
        UUID request = UUID.randomUUID(); String body = checkoutBody(request,2000,"prd-1000",2);
        var first = checkout(token(registration),body).andExpect(status().isOk()).andExpect(jsonPath("$.data.total").value(65.0))
            .andExpect(jsonPath("$.data.status").value("NEW")).andExpect(jsonPath("$.data.merchantApproved").value(false)).andReturn();
        long id = json.readTree(first.getResponse().getContentAsString()).at("/data/orderId").asLong();
        mvc.perform(get("/api/trips").header("Authorization","Bearer "+token(registration)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(1));
        checkout(token(registration),body).andExpect(status().isOk()).andExpect(jsonPath("$.data.orderId").value(id));
        assertThat(orders.findById(id).orElseThrow().getLines().get(0).getQuantity()).isEqualTo(2);
        checkout(token(registration),checkoutBody(request,2000,"prd-1000",3)).andExpect(status().isBadRequest());
        checkout(token(registration),checkoutBody(UUID.randomUUID(),2000,"prd-1000",100)).andExpect(status().isBadRequest());
    }

    @Test void merchantApprovalIsPairScopedAndRequiresOwnOrder() throws Exception {
        JsonNode registration = register("pair_customer"); long customer = registration.at("/user/id").asLong();
        completeDelivery(registration);
        User b = new User(9001L,"Merchant B",Role.AGENT,0); b.setUsername("agent_b"); users.save(b);
        trips.save(new Trip(9002L, 9001L, "Seoul", LocalDate.now().plusDays(3), TripStatus.PUBLISHED, LocalDateTime.now()));
        checkout(token(registration),checkoutBody(UUID.randomUUID(),2000,"prd-1000",1)).andExpect(status().isOk());
        mvc.perform(post("/api/merchant/customers/"+customer+"/approve").header("X-BOBBUY-ROLE","AGENT").header("X-BOBBUY-USER","9001")).andExpect(status().isForbidden());
        mvc.perform(post("/api/merchant/customers/"+customer+"/approve").header("X-BOBBUY-ROLE","AGENT").header("X-BOBBUY-USER","1000")).andExpect(status().isOk());
        assertThat(relations.findById("1000:"+customer).orElseThrow().approvedAt).isNotNull();
        assertThat(relations.findById("9001:"+customer)).isEmpty();
        assertThat(users.findById(customer).orElseThrow().getEmailVerifiedAt()).isNull();
        mvc.perform(get("/api/orders").header("X-BOBBUY-ROLE","AGENT").header("X-BOBBUY-USER","9001")).andExpect(status().isOk()).andExpect(jsonPath("$.data").isEmpty());
        mvc.perform(get("/api/trips/2000").header("X-BOBBUY-ROLE","AGENT").header("X-BOBBUY-USER","9001")).andExpect(status().isForbidden());
        mvc.perform(patch("/api/mobile/products/prd-1000").header("X-BOBBUY-ROLE","AGENT").header("X-BOBBUY-USER","9001")
            .contentType(MediaType.APPLICATION_JSON).content("{\"basePrice\":1}")).andExpect(status().isNotFound());
        checkout(token(registration),checkoutBody(UUID.randomUUID(),9002,"prd-1000",1)).andExpect(status().isBadRequest());
        mvc.perform(get("/api/procurement/customers/"+customer+"/ledger-history").header("X-BOBBUY-ROLE","AGENT").header("X-BOBBUY-USER","9001"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data").isEmpty());
        Product ownB = new Product(); ownB.setId("merchant-b-product"); ownB.setMerchantId(9001L);
        ownB.setName(Map.of("zh-CN","B 商品")); ownB.setBasePrice(100); ownB.setVisibilityStatus(ProductVisibility.PUBLIC); products.save(ownB);
        checkout(token(registration),checkoutBody(UUID.randomUUID(),9002,"merchant-b-product",1))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.merchantApproved").value(false));
        mvc.perform(post("/api/merchant/customers/"+customer+"/approve").header("X-BOBBUY-ROLE","AGENT").header("X-BOBBUY-USER","9001")).andExpect(status().isOk());
        assertThat(relations.findById("9001:"+customer).orElseThrow().approvedAt).isNotNull();
    }

    @Test void checkoutRequiresCompleteAddressOnlyForNewOrderAndRetainsOrderAndLedgerSnapshot() throws Exception {
        JsonNode registration=register("delivery_customer");String bearer=token(registration);
        UUID request=UUID.randomUUID();String body=checkoutBody(request,2000,"prd-1000",2);long before=orders.count();
        checkout(bearer,body).andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("checkout.address_required"));
        assertThat(orders.count()).isEqualTo(before);
        completeDelivery(registration);
        var first=checkout(bearer,body).andExpect(status().isOk()).andReturn();
        long id=json.readTree(first.getResponse().getContentAsString()).at("/data/orderId").asLong();
        var created=orders.findById(id).orElseThrow();assertThat(created.getDeliverySnapshot().city()).isEqualTo("Tokyo");assertThat(created.getDeliverySnapshot().phone()).isNull();
        mvc.perform(patch("/api/auth/profile").header("Authorization","Bearer "+bearer).contentType(MediaType.APPLICATION_JSON)
            .content("{\"defaultAddress\":{\"city\":\"Later city\",\"addressLine\":\"Later street\"}}" )).andExpect(status().isOk());
        mvc.perform(get("/api/customer/orders").header("Authorization","Bearer "+bearer)).andExpect(status().isOk())
            .andExpect(jsonPath("$.data[0].deliverySnapshot.city").value("Tokyo")).andExpect(jsonPath("$.data[0].deliverySnapshot.addressLine").value("Original street"))
            .andExpect(jsonPath("$.data[0].checkoutPayloadHash").doesNotExist());
        mvc.perform(get("/api/customer/procurement/2000/ledger").header("Authorization","Bearer "+bearer)).andExpect(status().isOk())
            .andExpect(jsonPath("$.data[0].deliveryAddressSource").value("ORDER_SNAPSHOT")).andExpect(jsonPath("$.data[0].deliveryAddressSummary").value("Japan Tokyo Original street"));
        mvc.perform(patch("/api/auth/profile").header("Authorization","Bearer "+bearer).contentType(MediaType.APPLICATION_JSON).content("{\"defaultAddress\":null}")).andExpect(status().isOk());
        // Original accepted operation remains retryable after profile, trip and pricing changed.
        var trip=trips.findById(2000L).orElseThrow();trip.setStatus(TripStatus.COMPLETED);trips.saveAndFlush(trip);
        var product=products.findById("prd-1000").orElseThrow();product.setBasePrice(999);products.saveAndFlush(product);
        checkout(bearer,body).andExpect(status().isOk()).andExpect(jsonPath("$.data.orderId").value(id)).andExpect(jsonPath("$.data.total").value(created.getTotalAmount()));
        var changed=(com.fasterxml.jackson.databind.node.ObjectNode)json.readTree(body);((com.fasterxml.jackson.databind.node.ObjectNode)changed.at("/items/0")).put("priceToken","different-quote");
        checkout(bearer,json.writeValueAsString(changed)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("checkout.request_conflict"));
        assertThat(orders.findById(id).orElseThrow().getDeliverySnapshot()).isEqualTo(created.getDeliverySnapshot());
        var other=register("delivery_other");mvc.perform(get("/api/customer/orders").header("Authorization","Bearer "+token(other))).andExpect(status().isOk()).andExpect(jsonPath("$.data").isEmpty());
    }

    @Test void concurrentIdenticalCheckoutUsesOneOrderAndOneImmutableSnapshot() throws Exception {
        JsonNode registration=register("checkout_parallel");completeDelivery(registration);String bearer=token(registration);
        UUID request=UUID.randomUUID();String body=checkoutBody(request,2000,"prd-1000",2);
        var executor=java.util.concurrent.Executors.newFixedThreadPool(2);var start=new java.util.concurrent.CountDownLatch(1);
        try {
            java.util.concurrent.Callable<Long> submit=()->{start.await();var response=checkout(bearer,body).andExpect(status().isOk()).andReturn();return json.readTree(response.getResponse().getContentAsString()).at("/data/orderId").asLong();};
            var first=executor.submit(submit);var second=executor.submit(submit);start.countDown();
            assertThat(first.get(15,java.util.concurrent.TimeUnit.SECONDS)).isEqualTo(second.get(15,java.util.concurrent.TimeUnit.SECONDS));
            assertThat(orders.findAll().stream().filter(o->o.getBusinessId().equals("WEB-"+registration.at("/user/id").asLong()+"-"+request))).hasSize(1);
        } finally {executor.shutdownNow();}
    }

    @Test void concurrentSameKeyDifferentPayloadCreatesOneOrderAndRejectsTheOther() throws Exception {
        var registration=register("checkout_conflict_parallel");completeDelivery(registration);String bearer=token(registration);var request=UUID.randomUUID();
        String firstBody=checkoutBody(request,2000,"prd-1000",1),secondBody=checkoutBody(request,2000,"prd-1000",2);
        var executor=java.util.concurrent.Executors.newFixedThreadPool(2);var start=new java.util.concurrent.CountDownLatch(1);
        try {
            var first=executor.submit(()->{start.await();return checkout(bearer,firstBody).andReturn().getResponse().getStatus();});
            var second=executor.submit(()->{start.await();return checkout(bearer,secondBody).andReturn().getResponse().getStatus();});start.countDown();
            assertThat(List.of(first.get(15,java.util.concurrent.TimeUnit.SECONDS),second.get(15,java.util.concurrent.TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,400);
            assertThat(orders.findAll().stream().filter(o->o.getBusinessId().equals("WEB-"+registration.at("/user/id").asLong()+"-"+request))).hasSize(1);
        } finally {executor.shutdownNow();}
    }

    @Test void failedQuoteLeavesNoPartialOrderOrRelationshipAndSameKeyValidRetrySucceeds() throws Exception {
        var registration=register("checkout_failure_retry");completeDelivery(registration);String bearer=token(registration);var request=UUID.randomUUID();
        String valid=checkoutBody(request,2000,"prd-1000",2);var invalid=(com.fasterxml.jackson.databind.node.ObjectNode)json.readTree(valid);
        ((com.fasterxml.jackson.databind.node.ObjectNode)invalid.at("/items/0")).put("priceToken","wrong-quote");long orderCount=orders.count(),relationCount=relations.count();
        checkout(bearer,json.writeValueAsString(invalid)).andExpect(status().isBadRequest());assertThat(orders.count()).isEqualTo(orderCount);assertThat(relations.count()).isEqualTo(relationCount);
        var response=checkout(bearer,valid).andExpect(status().isOk()).andReturn();long id=json.readTree(response.getResponse().getContentAsString()).at("/data/orderId").asLong();
        checkout(bearer,valid).andExpect(status().isOk()).andExpect(jsonPath("$.data.orderId").value(id));assertThat(orders.count()).isEqualTo(orderCount+1);assertThat(relations.count()).isEqualTo(relationCount+1);
    }

    @Test void concurrentProfileChangeAndCheckoutCaptureOneCompleteAddressUnderTheUserLock() throws Exception {
        JsonNode registration=register("delivery_parallel");completeDelivery(registration);String bearer=token(registration);String body=checkoutBody(UUID.randomUUID(),2000,"prd-1000",1);
        var executor=java.util.concurrent.Executors.newFixedThreadPool(2);var start=new java.util.concurrent.CountDownLatch(1);
        try {
            var ordering=executor.submit(()->{start.await();var response=checkout(bearer,body).andExpect(status().isOk()).andReturn();return json.readTree(response.getResponse().getContentAsString()).at("/data/orderId").asLong();});
            var changing=executor.submit(()->{start.await();return mvc.perform(patch("/api/auth/profile").header("Authorization","Bearer "+bearer).contentType(MediaType.APPLICATION_JSON)
                .content("{\"defaultAddress\":{\"city\":\"Kyoto\",\"addressLine\":\"New street\"}}" )).andReturn().getResponse().getStatus();});
            start.countDown();long id=ordering.get(15,java.util.concurrent.TimeUnit.SECONDS);assertThat(changing.get(15,java.util.concurrent.TimeUnit.SECONDS)).isEqualTo(200);
            var snapshot=orders.findById(id).orElseThrow().getDeliverySnapshot();assertThat(snapshot.city()+":"+snapshot.addressLine()).isIn("Tokyo:Original street","Kyoto:New street");
        } finally {executor.shutdownNow();}
    }

    @Test void legacySuccessfulCheckoutRetryDoesNotRequireAddressOrBackfillHistoricalFacts() throws Exception {
        JsonNode registration=register("legacy_retry");UUID request=UUID.randomUUID();
        var old=new OrderHeader("WEB-"+registration.at("/user/id").asLong()+"-"+request,registration.at("/user/id").asLong(),2000L);old.setId(98765L);
        var line=new OrderLine("prd-1000","Historical","pack",2,32.5);line.setId(98766L);old.addLine(line);old.setTotalAmount(65);orders.saveAndFlush(old);
        checkout(token(registration),checkoutBody(request,2000,"prd-1000",2)).andExpect(status().isOk()).andExpect(jsonPath("$.data.orderId").value(98765));
        var retained=orders.findById(98765L).orElseThrow();assertThat(retained.getDeliverySnapshot()).isNull();assertThat(retained.getCheckoutPayloadHash()).isNull();
    }

    @Test void registrationValidationAndMailFailureLeaveNoPartialAccount() throws Exception {
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
            .content("{\"username\":\"bad!\",\"password\":\"short\",\"email\":\"bad\"}"))
            .andExpect(status().isBadRequest());
        doThrow(new org.springframework.mail.MailSendException("test SMTP unavailable")).when(mail).send(any(SimpleMailMessage.class));
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
            .content("{\"username\":\"mail_failure\",\"password\":\"valid-password\",\"email\":\"mail_failure@example.com\"}"))
            .andExpect(status().isInternalServerError());
        assertThat(users.findByUsernameIgnoreCase("mail_failure")).isEmpty();
    }

    @Test void emailCodeExpiresIsOneTimeAndLocksAfterFiveFailures() throws Exception {
        JsonNode registration = register("verify_customer"); long id = registration.at("/user/id").asLong();
        ArgumentCaptor<SimpleMailMessage> sent = ArgumentCaptor.forClass(SimpleMailMessage.class); verify(mail).send(sent.capture());
        String code = sent.getValue().getText().replaceAll(".*?([0-9]{6}).*", "$1");
        assertThat(code).matches("[0-9]{6}"); assertThat(challenges.findById(id).orElseThrow().codeHash).doesNotContain(code);
        mvc.perform(post("/api/auth/email/resend").header("Authorization","Bearer "+token(registration))).andExpect(status().isBadRequest());
        String wrong = code.equals("000000") ? "111111" : "000000";
        for (int i=0;i<5;i++) verifyCode(token(registration),wrong).andExpect(status().isBadRequest());
        assertThat(challenges.findById(id).orElseThrow().attempts).isEqualTo(5);
        verifyCode(token(registration),code).andExpect(status().isBadRequest());
        var challenge = challenges.findById(id).orElseThrow(); challenge.attempts=0; challenge.expiresAt=Instant.now().minusSeconds(1); challenges.save(challenge);
        verifyCode(token(registration),code).andExpect(status().isBadRequest());
        challenge.expiresAt=Instant.now().plusSeconds(60); challenges.save(challenge);
        verifyCode(token(registration),code).andExpect(status().isOk());
        var consumed = challenges.findById(id).orElseThrow();
        assertThat(consumed.attempts).isEqualTo(5); assertThat(consumed.expiresAt).isEqualTo(Instant.EPOCH);
        assertThat(users.findById(id).orElseThrow().getEmailVerifiedAt()).isNotNull();
        assertThat(relations.findByMerchantId(1000L)).isEmpty();
    }
    ResultActions verifyCode(String token, String code) throws Exception {
        return mvc.perform(post("/api/auth/email/verify").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content("{\"code\":\""+code+"\"}"));
    }

    ResultActions profilePatch(String token, String body) throws Exception {
        return mvc.perform(patch("/api/auth/profile").header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    @Test void selfProfileSavesReopensPreservesOmissionsAndClearsOptionalFields() throws Exception {
        JsonNode registration = register("self_profile"); String bearer = token(registration);
        profilePatch(bearer, """
            {"name":"Customer Name","phone":"123","defaultAddress":{"city":"Tokyo","addressLine":"Street"},
             "socialAccounts":[{"platform":"Line","handle":"person","displayName":"Name"}]}
            """).andExpect(status().isOk()).andExpect(jsonPath("$.data.name").value("Customer Name"));
        profilePatch(bearer, "{\"defaultAddress\":{\"city\":\"Osaka\"}}")
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.defaultAddress.addressLine").value("Street"))
            .andExpect(jsonPath("$.data.phone").value("123"));
        mvc.perform(get("/api/auth/profile").header("Authorization", "Bearer " + bearer))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.defaultAddress.city").value("Osaka"))
            .andExpect(jsonPath("$.data.socialAccounts[0].verified").value(false))
            .andExpect(jsonPath("$.data.roles").doesNotExist()).andExpect(jsonPath("$.data.note").doesNotExist());
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + bearer))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.name").value("Customer Name"))
            .andExpect(jsonPath("$.data.phone").doesNotExist());
        profilePatch(bearer, "{\"phone\":null,\"defaultAddress\":null,\"socialAccounts\":[]}")
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.phone").doesNotExist())
            .andExpect(jsonPath("$.data.defaultAddress").doesNotExist()).andExpect(jsonPath("$.data.socialAccounts").isEmpty());
    }

    @Test void selfProfileRejectsIdentityAndTrustedFieldsAndOtherUserSelection() throws Exception {
        JsonNode first = register("profile_first"), second = register("profile_second");
        for (String field : List.of("id", "userId", "username", "roles", "platformAdmin", "merchantId", "emailVerified", "emailVerifiedAt", "note")) {
            profilePatch(token(first), "{\"" + field + "\":null}").andExpect(status().isBadRequest());
        }
        for (String field : List.of("verified", "note", "userId")) {
            profilePatch(token(first), "{\"socialAccounts\":[{\"platform\":\"Line\",\"handle\":\"x\",\"" + field + "\":true}]}")
                .andExpect(status().isBadRequest());
        }
        profilePatch(token(first), "{\"defaultAddress\":{\"userId\":1}}").andExpect(status().isBadRequest());
        mvc.perform(get("/api/auth/profile").param("userId", second.at("/user/id").asText()).header("Authorization", "Bearer " + token(first)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.id").value(first.at("/user/id").asLong()));
        mvc.perform(get("/api/auth/profile")).andExpect(status().isUnauthorized());
        mvc.perform(patch("/api/auth/profile").contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isUnauthorized());
        mvc.perform(patch("/api/users/" + second.at("/user/id").asLong()).header("Authorization", "Bearer " + token(first))
            .contentType(MediaType.APPLICATION_JSON).content("{}" )).andExpect(status().isForbidden());
    }

    @Test void emailChangeNormalizesRejectsDuplicatesAndInvalidatesOldCodeWithoutResettingCooldown() throws Exception {
        JsonNode first = register("profile_email"), second = register("profile_taken");
        ArgumentCaptor<SimpleMailMessage> sent = ArgumentCaptor.forClass(SimpleMailMessage.class); verify(mail, atLeastOnce()).send(sent.capture());
        String oldCode = sent.getAllValues().get(0).getText().replaceAll(".*?([0-9]{6}).*", "$1");
        long id = first.at("/user/id").asLong(); Instant sentAt = challenges.findById(id).orElseThrow().sentAt;
        profilePatch(token(first), "{\"email\":\" PROFILE_TAKEN@EXAMPLE.COM \"}").andExpect(status().isBadRequest());
        profilePatch(token(first), "{\"email\":null}").andExpect(status().isBadRequest());
        profilePatch(token(first), "{\"email\":\" \"}").andExpect(status().isBadRequest());
        profilePatch(token(first), "{\"email\":\" NEW_TARGET@EXAMPLE.COM \"}")
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.email").value("new_target@example.com"))
            .andExpect(jsonPath("$.data.emailVerified").value(false));
        assertThat(challenges.findById(id).orElseThrow().sentAt).isEqualTo(sentAt);
        verifyCode(token(first), oldCode).andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/email/resend").header("Authorization", "Bearer " + token(first))).andExpect(status().isBadRequest());
        verify(mail, times(2)).send(any(SimpleMailMessage.class)); // Saving does not send.
        var expired = challenges.findById(id).orElseThrow(); expired.sentAt = Instant.now().minusSeconds(61).truncatedTo(java.time.temporal.ChronoUnit.MILLIS); challenges.save(expired);
        doThrow(new com.bobbuy.api.response.ApiException(com.bobbuy.api.response.ErrorCode.INVALID_REQUEST, "SMTP test unavailable"))
            .when(mail).send(any(SimpleMailMessage.class));
        mvc.perform(post("/api/auth/email/resend").header("Authorization", "Bearer " + token(first))).andExpect(status().isBadRequest());
        var failed = challenges.findById(id).orElseThrow();
        assertThat(failed.attempts).isEqualTo(5); assertThat(failed.expiresAt).isEqualTo(Instant.EPOCH);
        assertThat(failed.sentAt).isEqualTo(expired.sentAt);
        doNothing().when(mail).send(any(SimpleMailMessage.class));
        mvc.perform(post("/api/auth/email/resend").header("Authorization", "Bearer " + token(first))).andExpect(status().isOk());
        verify(mail, atLeastOnce()).send(sent.capture());
        assertThat(sent.getValue().getTo()).containsExactly("new_target@example.com");
        String code = sent.getValue().getText().replaceAll(".*?([0-9]{6}).*", "$1");
        verifyCode(token(first), code).andExpect(status().isOk());
        mvc.perform(get("/api/auth/profile").header("Authorization", "Bearer " + token(first)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.emailVerified").value(true));
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token(first)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.emailVerified").value(true));
    }

    @Test void concurrentOldVerificationAndEmailChangeCannotVerifyTheNewAddress() throws Exception {
        JsonNode registration = register("profile_race");
        long id = registration.at("/user/id").asLong(); Instant sentAt = challenges.findById(id).orElseThrow().sentAt;
        ArgumentCaptor<SimpleMailMessage> sent = ArgumentCaptor.forClass(SimpleMailMessage.class); verify(mail).send(sent.capture());
        String code = sent.getValue().getText().replaceAll(".*?([0-9]{6}).*", "$1");
        var executor = java.util.concurrent.Executors.newFixedThreadPool(2);
        var start = new java.util.concurrent.CountDownLatch(1);
        try {
            var changing = executor.submit(() -> { start.await(); return profilePatch(token(registration), "{\"email\":\"race_new@example.com\"}").andReturn().getResponse().getStatus(); });
            var verifying = executor.submit(() -> { start.await(); return verifyCode(token(registration), code).andReturn().getResponse().getStatus(); });
            start.countDown();
            assertThat(changing.get(10, java.util.concurrent.TimeUnit.SECONDS)).isEqualTo(200);
            assertThat(verifying.get(10, java.util.concurrent.TimeUnit.SECONDS)).isIn(200, 400);
            User user = users.findById(registration.at("/user/id").asLong()).orElseThrow();
            assertThat(user.getEmail()).isEqualTo("race_new@example.com"); assertThat(user.getEmailVerifiedAt()).isNull();
            verifyCode(token(registration), code).andExpect(status().isBadRequest());
            var consumed = challenges.findById(id).orElseThrow();
            assertThat(consumed.sentAt).isEqualTo(sentAt); assertThat(consumed.attempts).isEqualTo(5);
            mvc.perform(post("/api/auth/email/resend").header("Authorization", "Bearer " + token(registration))).andExpect(status().isBadRequest());
            verify(mail, times(1)).send(any(SimpleMailMessage.class));
        } finally { executor.shutdownNow(); }
    }

    @Test void verifiedThenChangedEmailRetainsCooldownAndFailedSendCannotReplaceConsumedCode() throws Exception {
        JsonNode registration = register("verified_cooldown"); String bearer = token(registration);
        long id = registration.at("/user/id").asLong();
        ArgumentCaptor<SimpleMailMessage> sent = ArgumentCaptor.forClass(SimpleMailMessage.class); verify(mail).send(sent.capture());
        String oldCode = sent.getValue().getText().replaceAll(".*?([0-9]{6}).*", "$1");
        Instant sentAt = challenges.findById(id).orElseThrow().sentAt;
        verifyCode(bearer, oldCode).andExpect(status().isOk());
        var consumed = challenges.findById(id).orElseThrow();
        assertThat(consumed.sentAt).isEqualTo(sentAt); assertThat(consumed.attempts).isEqualTo(5);
        assertThat(consumed.expiresAt).isEqualTo(Instant.EPOCH);
        profilePatch(bearer, "{\"email\":\"verified_changed@example.com\"}").andExpect(status().isOk());
        profilePatch(bearer, "{\"email\":\"verified_after_cooldown@example.com\"}").andExpect(status().isOk());
        assertThat(users.findById(id).orElseThrow().getEmailVerifiedAt()).isNull();
        verifyCode(bearer, oldCode).andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/email/resend").header("Authorization", "Bearer " + bearer)).andExpect(status().isBadRequest());
        assertThat(challenges.findById(id).orElseThrow().sentAt).isEqualTo(sentAt);
        verify(mail, times(1)).send(any(SimpleMailMessage.class));

        // Move only the isolated test's clock fixture past the throttle, without sleeping.
        consumed = challenges.findById(id).orElseThrow();
        consumed.sentAt = Instant.now().minusSeconds(61).truncatedTo(java.time.temporal.ChronoUnit.MILLIS);
        challenges.save(consumed);
        doThrow(new org.springframework.mail.MailSendException("synthetic SMTP failure after verification"))
            .when(mail).send(any(SimpleMailMessage.class));
        mvc.perform(post("/api/auth/email/resend").header("Authorization", "Bearer " + bearer)).andExpect(status().isInternalServerError());
        var failed = challenges.findById(id).orElseThrow();
        assertThat(failed.sentAt).isEqualTo(consumed.sentAt); assertThat(failed.codeHash).isEqualTo(consumed.codeHash);
        assertThat(failed.attempts).isEqualTo(5); assertThat(failed.expiresAt).isEqualTo(Instant.EPOCH);
        doNothing().when(mail).send(any(SimpleMailMessage.class));
        mvc.perform(post("/api/auth/email/resend").header("Authorization", "Bearer " + bearer)).andExpect(status().isOk());
        verify(mail, times(3)).send(sent.capture()); assertThat(sent.getValue().getTo()).containsExactly("verified_after_cooldown@example.com");
        assertThat(challenges.findById(id).orElseThrow().attempts).isZero();
        String newCode = sent.getValue().getText().replaceAll(".*?([0-9]{6}).*", "$1");
        verifyCode(bearer, newCode).andExpect(status().isOk());
        assertThat(users.findById(id).orElseThrow().getEmailVerifiedAt()).isNotNull();
    }
}
