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
    @Autowired MerchantCustomerRepository relations;
    @MockBean JavaMailSender mail;

    @BeforeEach void setup() {
        challenges.deleteAll(); relations.deleteAll(); store.seed();
    }
    @AfterEach void cleanup() { challenges.deleteAll(); relations.deleteAll(); }

    JsonNode register(String name) throws Exception {
        return json.readTree(mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("username", name, "password", "valid-password", "email", name + "@example.com"))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.user.emailVerified").value(false))
            .andExpect(jsonPath("$.data.user.roles[0]").value("CUSTOMER")).andExpect(jsonPath("$.data.refreshToken").doesNotExist())
            .andReturn().getResponse().getContentAsString()).get("data");
    }
    String token(JsonNode registration) { return registration.get("accessToken").asText(); }
    String checkoutBody(UUID requestId, long tripId, String product, int quantity) throws Exception {
        return json.writeValueAsString(Map.of("requestId",requestId,"tripId",tripId,"items",List.of(Map.of("productId",product,"quantity",quantity))));
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
        assertThat(challenges.findById(id)).isEmpty(); assertThat(users.findById(id).orElseThrow().getEmailVerifiedAt()).isNotNull();
        assertThat(relations.findByMerchantId(1000L)).isEmpty();
    }
    ResultActions verifyCode(String token, String code) throws Exception {
        return mvc.perform(post("/api/auth/email/verify").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content("{\"code\":\""+code+"\"}"));
    }
}
