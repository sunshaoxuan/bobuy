package com.bobbuy.api;

import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.service.*;
import com.bobbuy.security.JwtTokenService;
import com.bobbuy.api.response.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Supplier;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.core.env.Environment;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Executes only in the existing isolated test datasource; never run against a business datasource.
 * PostgreSQL execution is a required later CI gate, not implied by compiling this source.
 */
@SpringBootTest(properties="bobbuy.security.header-auth.enabled=false")
@AutoConfigureMockMvc
class CustomerOrderAmendmentIntegrationTest {
    @Autowired CustomerOrderAmendmentService service;
    @Autowired StorefrontService storefront;
    @Autowired BobbuyStore store;
    @Autowired ProcurementHudService procurement;
    @Autowired OrderWriteCoordinator writers;
    @Autowired UserRepository users;
    @Autowired TripRepository trips;
    @Autowired OrderHeaderRepository orders;
    @Autowired CustomerOrderAmendmentReceiptRepository receipts;
    @Autowired JwtTokenService jwt;
    @Autowired ObjectMapper json;
    @Autowired MockMvc mvc;
    @Autowired PlatformTransactionManager transactions;
    @Autowired Environment environment;
    @Autowired JdbcTemplate jdbc;
    @MockBean JavaMailSender mail;
    User user;Authentication customer;Long orderId;String token;StorefrontService.Checkout checkout;
    TransactionTemplate tx;
    @BeforeEach void isolatedFixture() {
        String url=environment.getProperty("spring.datasource.url","");
        assertTrue(url.startsWith("jdbc:h2:mem:")||("true".equals(System.getenv("BOBBUY_ISOLATED_CI_POSTGRES"))&&(url.startsWith("jdbc:postgresql://localhost:")||url.startsWith("jdbc:postgresql://127.0.0.1:"))),"Refuse unproved non-isolated C3 datasource before seeding");
        store.seed();tx=new TransactionTemplate(transactions);
        String unique=UUID.randomUUID().toString();long id=1_000_000_000L+(UUID.randomUUID().getLeastSignificantBits()&0xffffff);
        user=new User(id,"Synthetic C3",Role.CUSTOMER,0);user.setUsername("c3-"+unique);user.setEnabled(true);user.setEmail("c3-"+unique+"@example.invalid");
        var address=new User.UserAddress();address.setContactName("Original");address.setCountryRegion("JP");address.setCity("Tokyo");address.setAddressLine("Synthetic street");user.setDefaultAddress(address);users.saveAndFlush(user);
        var trip=trips.findById(2000L).orElseThrow();trip.setStatus(TripStatus.PUBLISHED);trip.setDeliveryDate(LocalDate.now().plusDays(2));trips.saveAndFlush(trip);
        customer=new UsernamePasswordAuthenticationToken(String.valueOf(id),null,AuthorityUtils.createAuthorityList("ROLE_CUSTOMER"));token=jwt.createAccessToken(user);
        var product=storefront.publicProducts().stream().filter(p->p.id().equals("prd-1000")).findFirst().orElseThrow();
        checkout=new StorefrontService.Checkout(UUID.randomUUID(),2000L,List.of(new StorefrontService.Item(product.id(),1,product.priceRevision(),product.currency(),product.priceToken())),product.currency());
        orderId=storefront.checkout(customer,checkout).orderId();
    }
    CustomerOrderAmendmentRequest input(String key,int quantity) {
        var view=service.preview(customer,orderId);var line=view.lines().get(0);
        return new CustomerOrderAmendmentRequest(key,view.revision(),List.of(new CustomerOrderAmendmentRequest.Line(line.productId(),quantity,line.priceToken(),line.priceRevision(),line.currency())),null);
    }
    @Test void readOnlyPreviewsKeepRevisionStableButActualEditAdvancesAndRejectsStaleInput() {
        long version=orders.findById(orderId).orElseThrow().getOrderRevision();
        var request=input(UUID.randomUUID().toString(),3);
        for(int attempt=0;attempt<3;attempt++) {
            var view=service.preview(customer,orderId);
            assertTrue(view.editable());assertEquals(request.expectedRevision(),view.revision());
            assertEquals(version,orders.findById(orderId).orElseThrow().getOrderRevision(),"read-only query must not advance revision");
        }
        var changed=service.amend(customer,orderId,request);
        assertNotEquals(request.expectedRevision(),changed.revision());
        assertEquals(version+1,orders.findById(orderId).orElseThrow().getOrderRevision());
        var stale=new CustomerOrderAmendmentRequest(UUID.randomUUID().toString(),request.expectedRevision(),request.lines(),null);
        assertThrows(org.springframework.orm.ObjectOptimisticLockingFailureException.class,()->service.amend(customer,orderId,stale));
        assertEquals(version+1,orders.findById(orderId).orElseThrow().getOrderRevision());
        assertEquals(3,orders.findById(orderId).orElseThrow().getLines().get(0).getQuantity());
    }
    @Test void authenticatedEndpointWhitelistSaveReopenAndCheckoutRetryPreserveOneOrder() throws Exception {
        mvc.perform(get("/api/customer/orders/"+orderId+"/amendment")).andExpect(status().isUnauthorized());
        var request=input(UUID.randomUUID().toString(),3);
        String body=json.writeValueAsString(request);
        mvc.perform(patch("/api/customer/orders/"+orderId+"/amendment").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(body.substring(0,body.length()-1)+",\"customerId\":1001}"))
            .andExpect(status().isBadRequest());
        mvc.perform(patch("/api/customer/orders/"+orderId+"/amendment").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.lines[0].quantity").value(3));
        mvc.perform(get("/api/customer/orders/"+orderId+"/amendment").header("Authorization","Bearer "+token)).andExpect(status().isOk()).andExpect(jsonPath("$.data.lines[0].quantity").value(3));
        assertEquals(3,orders.findById(orderId).orElseThrow().getLines().get(0).getQuantity());
        assertEquals(orderId,storefront.checkout(customer,checkout).orderId());assertEquals(3,orders.findById(orderId).orElseThrow().getLines().get(0).getQuantity());
        assertTrue(receipts.findById(user.getId()+":"+request.requestId()).isPresent());
    }
    @Test void rollbackAfterBothFlushesRestoresOriginalOrderAndAllowsSameKeyRetry() {
        var request=input(UUID.randomUUID().toString(),3);long version=orders.findById(orderId).orElseThrow().getOrderRevision();
        tx.execute(status->{service.amend(customer,orderId,request);status.setRollbackOnly();return null;});
        assertEquals(1,orders.findById(orderId).orElseThrow().getLines().get(0).getQuantity());assertEquals(version,orders.findById(orderId).orElseThrow().getOrderRevision());
        assertTrue(receipts.findById(user.getId()+":"+request.requestId()).isEmpty());
        service.amend(customer,orderId,request);assertEquals(3,orders.findById(orderId).orElseThrow().getLines().get(0).getQuantity());
    }
    @Test void simultaneousSameUserKeyAppliesOnceAndChangedReplayIsRejected() throws Exception {
        var request=input(UUID.randomUUID().toString(),3);long version=orders.findById(orderId).orElseThrow().getOrderRevision();var pool=Executors.newFixedThreadPool(2);
        try{var a=pool.submit(()->service.amend(customer,orderId,request));var b=pool.submit(()->service.amend(customer,orderId,request));assertEquals(a.get(10,TimeUnit.SECONDS),b.get(10,TimeUnit.SECONDS));}
        finally{pool.shutdownNow();assertTrue(pool.awaitTermination(5,TimeUnit.SECONDS));}
        assertEquals(version+1,orders.findById(orderId).orElseThrow().getOrderRevision());
        var changed=new CustomerOrderAmendmentRequest(request.requestId(),request.expectedRevision(),List.of(new CustomerOrderAmendmentRequest.Line(request.lines().get(0).productId(),4,request.lines().get(0).priceToken(),request.lines().get(0).priceRevision(),request.lines().get(0).currency())),null);
        assertThrows(org.springframework.orm.ObjectOptimisticLockingFailureException.class,()->service.amend(customer,orderId,changed));
    }
    @Test void merchantConfirmationWinningTripLockPreventsCustomerEdit() throws Exception {
        var request=input(UUID.randomUUID().toString(),3);
        var results=queuedRace(()->{store.updateOrderStatus(orderId,OrderStatus.CONFIRMED);return "confirmed";},()->service.amend(customer,orderId,request),false);
        assertEquals("confirmed",results.get(0));assertInstanceOf(org.springframework.orm.ObjectOptimisticLockingFailureException.class,results.get(1));
        var current=orders.findById(orderId).orElseThrow();assertEquals(OrderStatus.CONFIRMED,current.getStatus());assertEquals(1,current.getLines().get(0).getQuantity());
        assertTrue(receipts.findById(user.getId()+":"+request.requestId()).isEmpty());
    }
    @Test void customerWinningTripLockIsPreservedByQueuedMerchantStatusCommand() throws Exception {
        var request=input(UUID.randomUUID().toString(),3);
        var results=queuedRace(()->service.amend(customer,orderId,request),()->store.updateOrderStatus(orderId,OrderStatus.CONFIRMED),true);
        assertInstanceOf(CustomerOrderAmendmentView.class,results.get(0));assertInstanceOf(OrderHeader.class,results.get(1));
        var current=orders.findById(orderId).orElseThrow();assertEquals(OrderStatus.CONFIRMED,current.getStatus());assertEquals(3,current.getLines().get(0).getQuantity());assertEquals(PaymentStatus.UNPAID,current.getPaymentStatus());
    }
    @Test void queuedStaleMerchantReplacementCannotOverwriteCustomerRevision() throws Exception {
        var original=orders.findById(orderId).orElseThrow();var stale=json.convertValue(original,OrderHeader.class);stale.setExpectedOrderRevision(original.getOrderRevision());
        var request=input(UUID.randomUUID().toString(),3);
        var results=queuedRace(()->service.amend(customer,orderId,request),()->store.updateOrder(orderId,stale),true);
        assertInstanceOf(CustomerOrderAmendmentView.class,results.get(0));assertInstanceOf(org.springframework.orm.ObjectOptimisticLockingFailureException.class,results.get(1));
        assertEquals(3,orders.findById(orderId).orElseThrow().getLines().get(0).getQuantity());
    }
    @Test void currentOwnershipIsRequiredForReceiptReplayAndSameOwnerPaidReplayNeverWrites() {
        var request=input(UUID.randomUUID().toString(),3);var accepted=service.amend(customer,orderId,request);
        tx.execute(status->{var order=writers.existing(orderId);order.setPaymentStatus(PaymentStatus.PAID);orders.saveAndFlush(order);return null;});
        long version=orders.findById(orderId).orElseThrow().getOrderRevision();assertEquals(accepted,service.amend(customer,orderId,request));assertEquals(version,orders.findById(orderId).orElseThrow().getOrderRevision());
        tx.execute(status->{var order=writers.existing(orderId);order.setCustomerId(1001L);orders.saveAndFlush(order);return null;});
        assertEquals(ErrorCode.RESOURCE_NOT_FOUND,assertThrows(ApiException.class,()->service.amend(customer,orderId,request)).getErrorCode());
    }
    @Test void realPreviousEntityMappingRetainsV29RevisionAndPrivateHistory() {
        var request=input(UUID.randomUUID().toString(),3);service.amend(customer,orderId,request);long revision=orders.findById(orderId).orElseThrow().getOrderRevision();
        var oldMapping=new org.hibernate.cfg.Configuration().addAnnotatedClass(com.bobbuy.compat.PreviousOrderHeader.class)
            .setPhysicalNamingStrategy(new org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy()).setProperty("hibernate.hbm2ddl.auto","validate");
        oldMapping.getProperties().put("hibernate.connection.datasource",jdbc.getDataSource());
        try(var factory=oldMapping.buildSessionFactory();var session=factory.openSession()){
            var transaction=session.beginTransaction();var old=session.find(com.bobbuy.compat.PreviousOrderHeader.class,orderId);old.setDesiredDeliveryWindow("Synthetic legacy window");transaction.commit();
        }
        assertEquals(revision,orders.findById(orderId).orElseThrow().getOrderRevision());assertTrue(receipts.findById(user.getId()+":"+request.requestId()).isPresent());
    }
    List<Object> queuedRace(Supplier<?> first,Supplier<?> second,boolean customerFirst) throws Exception {
        var locked=new CountDownLatch(1);var release=new CountDownLatch(1);var entered=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(2);
        try {
            var a=pool.submit(()->tx.execute(status->{if(customerFirst)users.lockById(user.getId()).orElseThrow();writers.trip(2000L);locked.countDown();await(release);return first.get();}));
            assertTrue(locked.await(5,TimeUnit.SECONDS));var b=pool.submit(()->{entered.countDown();try{return second.get();}catch(RuntimeException failure){return failure;}});
            assertTrue(entered.await(5,TimeUnit.SECONDS));assertThrows(TimeoutException.class,()->b.get(150,TimeUnit.MILLISECONDS));release.countDown();return List.of(a.get(10,TimeUnit.SECONDS),b.get(10,TimeUnit.SECONDS));
        } finally {release.countDown();pool.shutdownNow();assertTrue(pool.awaitTermination(5,TimeUnit.SECONDS));}
    }
    static void await(CountDownLatch latch){try{if(!latch.await(5,TimeUnit.SECONDS))throw new IllegalStateException("Test lock timeout");}catch(InterruptedException e){Thread.currentThread().interrupt();throw new IllegalStateException(e);}}
}
