package com.bobbuy.service;

import com.bobbuy.api.*;
import com.bobbuy.api.response.*;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.security.core.Authentication;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CustomerOrderAmendmentServiceTest {
    AuthService auth;UserRepository users;OrderHeaderRepository orders;ProductRepository products;
    CheckoutIdentityRepository ids;CustomerOrderAmendmentReceiptRepository receipts;CustomerPaymentLedgerRepository payments;
    OrderWriteCoordinator writers;ProductSaleService sales;StorefrontService storefront;ProcurementHudService procurement;EntityManager em;
    final ObjectMapper json=new ObjectMapper().findAndRegisterModules();
    final Authentication authentication=mock(Authentication.class);
    final String productId="98e8de5e-2122-451b-89c8-693439d90b60";
    final Map<String,CustomerOrderAmendmentReceipt> saved=new HashMap<>();
    OrderHeader order;Trip trip;Product product;User user;CustomerOrderAmendmentService service;
    @BeforeEach void setup() throws Exception {
        auth=mock(AuthService.class);users=mock(UserRepository.class);orders=mock(OrderHeaderRepository.class);products=mock(ProductRepository.class);
        ids=mock(CheckoutIdentityRepository.class);receipts=mock(CustomerOrderAmendmentReceiptRepository.class);payments=mock(CustomerPaymentLedgerRepository.class);
        writers=mock(OrderWriteCoordinator.class);sales=mock(ProductSaleService.class);storefront=mock(StorefrontService.class);procurement=mock(ProcurementHudService.class);em=mock(EntityManager.class);
        user=new User(2L,"Customer",Role.CUSTOMER,0);user.setEnabled(true);
        when(auth.currentUser(authentication)).thenReturn(new AuthService.UserProfile(2L,"customer","Customer",Set.of(Role.CUSTOMER),"synthetic@example.invalid",false,false));
        when(users.lockById(2L)).thenReturn(Optional.of(user));
        trip=new Trip(7L,3L,"Synthetic",LocalDate.now().plusDays(2),TripStatus.PUBLISHED,LocalDateTime.now());
        resetOrder();when(writers.existing(9L)).thenAnswer(i->order);when(writers.trip(7L)).thenReturn(trip);
        when(payments.findByTripIdAndBusinessIdOrderByCreatedAtAscIdAsc(anyLong(),anyString())).thenReturn(List.of());
        product=new Product();product.setId(productId);product.setMerchantId(3L);product.setVisibilityStatus(ProductVisibility.PUBLIC);product.setName(Map.of("en-US","Synthetic tea"));
        when(products.lockById(productId)).thenReturn(Optional.of(product));when(sales.now()).thenReturn(Instant.parse("2026-11-09T10:00:00Z"));
        when(products.findAllById(any())).thenReturn(List.of(product));
        when(sales.quoteAt(eq(product),any())).thenReturn(Optional.of(quote("quote-a")));
        when(storefront.publicProducts()).thenReturn(List.of(new StorefrontService.PublicProduct(productId,3L,Map.of("en-US","Synthetic tea"),Map.of(),"Brand",10D,null,List.of(),"JPY","pack",1,true,"quote-a",null,null,null,null)));
        when(receipts.findById(anyString())).thenAnswer(i->Optional.ofNullable(saved.get(i.getArgument(0))));
        when(receipts.saveAndFlush(any())).thenAnswer(i->{CustomerOrderAmendmentReceipt r=i.getArgument(0);saved.put(r.id,r);return r;});
        when(orders.saveAndFlush(any())).thenAnswer(i->{setVersion(order,(order.getOrderRevision()==null?0:order.getOrderRevision())+1);return i.getArgument(0);});
        service=new CustomerOrderAmendmentService(auth,users,orders,products,ids,receipts,payments,writers,sales,storefront,procurement,em,json);
    }
    void resetOrder() throws Exception {
        order=new OrderHeader("SYNTHETIC-ORDER",2L,7L);order.setId(9L);order.setCurrency("JPY");order.setTotalAmount(10);
        order.setDeliverySnapshot(new OrderDeliverySnapshot(1,"A",null,"JP","Tokyo","Street",null));
        var line=new OrderLine(productId,"Synthetic tea","pack",1,10);line.setId(10L);line.setHeaderId(9L);order.addLine(line);setVersion(order,0L);
    }
    static void setVersion(OrderHeader o,long v)throws Exception{var field=OrderHeader.class.getDeclaredField("orderRevision");field.setAccessible(true);field.set(o,v);}
    ProductSaleService.Quote quote(String token){return new ProductSaleService.Quote(BigDecimal.TEN,"JPY","pack",1,token,null,null,null,null,"SYNTHETIC");}
    CustomerOrderAmendmentRequest input(String requestId,String revision,int quantity){return new CustomerOrderAmendmentRequest(requestId,revision,List.of(new CustomerOrderAmendmentRequest.Line(productId,quantity,"quote-a",1L,"JPY")),null);}
    @Test void ownPrincipalAndFreshRoleAreRequiredWithoutLeakingOtherOrder() {
        order.setCustomerId(99L);assertEquals(ErrorCode.RESOURCE_NOT_FOUND,assertThrows(ApiException.class,()->service.preview(authentication,9L)).getErrorCode());
        order.setCustomerId(2L);user.setRoles(Set.of(Role.AGENT));assertEquals(ErrorCode.FORBIDDEN,assertThrows(ApiException.class,()->service.preview(authentication,9L)).getErrorCode());
        verify(orders,never()).saveAndFlush(any());
    }
    @Test void savesOnlyUncommittedLinesAndOrderAddressWithAtomicHistoryReceipt() {
        var view=service.preview(authentication,9L);var request=input(UUID.randomUUID().toString(),view.revision(),3);
        var destination=new CustomerOrderAmendmentRequest.Delivery("B","1","JP","Osaka","New street","123");
        var result=service.amend(authentication,9L,new CustomerOrderAmendmentRequest(request.requestId(),request.expectedRevision(),request.lines(),destination));
        assertEquals(30D,order.getTotalAmount());assertEquals(3,order.getLines().get(0).getQuantity());assertEquals(10L,order.getLines().get(0).getId());
        assertEquals(OrderStatus.NEW,order.getStatus());assertEquals(PaymentStatus.UNPAID,order.getPaymentStatus());assertEquals("Osaka",order.getDeliverySnapshot().city());
        assertNotEquals(view.revision(),result.revision());assertEquals(1,saved.size());var receipt=saved.values().iterator().next();
        assertEquals(1,receipt.originalOrder.at("/lines/0/quantity").asInt());assertEquals(3,receipt.resultView.at("/lines/0/quantity").asInt());
        var sequence=inOrder(users,em,writers,products,orders,receipts);sequence.verify(users).lockById(2L);sequence.verify(em).refresh(user,LockModeType.PESSIMISTIC_WRITE);
        sequence.verify(writers).existing(9L);sequence.verify(writers).trip(7L);sequence.verify(products).lockById(productId);sequence.verify(em).refresh(product,LockModeType.PESSIMISTIC_WRITE);
        sequence.verify(orders).saveAndFlush(order);sequence.verify(receipts).saveAndFlush(any());
    }
    @Test void unchangedRetryReplaysOriginalResultButChangedPayloadCannotReuseKey() {
        var view=service.preview(authentication,9L);var request=input(UUID.randomUUID().toString(),view.revision(),3);
        var once=service.amend(authentication,9L,request);order.setStatus(OrderStatus.CONFIRMED);order.setPaymentStatus(PaymentStatus.PAID);
        var replay=service.amend(authentication,9L,request);assertEquals(once,replay);assertEquals(1,saved.size());verify(orders,times(1)).saveAndFlush(any());
        assertThrows(org.springframework.orm.ObjectOptimisticLockingFailureException.class,()->service.amend(authentication,9L,input(request.requestId(),request.expectedRevision(),4)));
    }
    @Test void existingReceiptDoesNotBypassCurrentOwnerAfterMerchantReassignment() {
        var request=input(UUID.randomUUID().toString(),service.preview(authentication,9L).revision(),3);
        service.amend(authentication,9L,request);assertEquals(1,saved.size());order.setCustomerId(99L);
        var error=assertThrows(ApiException.class,()->service.amend(authentication,9L,request));
        assertEquals(ErrorCode.RESOURCE_NOT_FOUND,error.getErrorCode());verify(orders,times(1)).saveAndFlush(any());
        assertEquals(1,saved.size());assertEquals(3,order.getLines().get(0).getQuantity());
    }
    @Test void rejectsStaleRevisionAndChangedLiveQuoteWithoutAnySave() {
        var view=service.preview(authentication,9L);
        assertThrows(org.springframework.orm.ObjectOptimisticLockingFailureException.class,()->service.amend(authentication,9L,input(UUID.randomUUID().toString(),"b".repeat(64),3)));
        when(sales.quoteAt(eq(product),any())).thenReturn(Optional.of(quote("changed")));
        assertThrows(org.springframework.orm.ObjectOptimisticLockingFailureException.class,()->service.amend(authentication,9L,input(UUID.randomUUID().toString(),view.revision(),3)));
        verify(orders,never()).saveAndFlush(any());assertTrue(saved.isEmpty());
    }
    @Test void allProcurementPaymentAndFulfillmentCommitmentsFailClosed() throws Exception {
        for(var status:List.of(OrderStatus.CONFIRMED,OrderStatus.PURCHASED,OrderStatus.DELIVERED,OrderStatus.SETTLED,OrderStatus.CANCELLED)) {resetOrder();order.setStatus(status);assertFalse(service.preview(authentication,9L).editable());}
        for(var payment:List.of(PaymentStatus.PAID,PaymentStatus.REFUNDED)){resetOrder();order.setPaymentStatus(payment);assertFalse(service.preview(authentication,9L).editable());}
        resetOrder();order.getLines().get(0).setPurchasedQuantity(1);assertFalse(service.preview(authentication,9L).editable());
        resetOrder();order.getLines().get(0).setPickingConfirmed(true);assertFalse(service.preview(authentication,9L).editable());
        resetOrder();when(procurement.hasOrderProcurementCommitment(order)).thenReturn(true);assertFalse(service.preview(authentication,9L).editable());
        resetOrder();when(payments.findByTripIdAndBusinessIdOrderByCreatedAtAscIdAsc(7L,"SYNTHETIC-ORDER")).thenReturn(List.of(new CustomerPaymentLedger()));var locked=service.preview(authentication,9L);assertFalse(locked.editable());
        assertThrows(org.springframework.orm.ObjectOptimisticLockingFailureException.class,()->service.amend(authentication,9L,input(UUID.randomUUID().toString(),locked.revision(),3)));
        verify(orders,never()).saveAndFlush(any());
    }
    @Test void tripOrderLocksRefreshPreviouslyAttachedSnapshotsInOneDirection() {
        var tripRepo=mock(TripRepository.class);var orderRepo=mock(OrderHeaderRepository.class);var entityManager=mock(EntityManager.class);
        var locator=mock(OrderHeaderRepository.Location.class);when(locator.getTripId()).thenReturn(7L);when(orderRepo.locate(9L)).thenReturn(Optional.of(locator));
        when(tripRepo.findByIdForUpdate(7L)).thenReturn(Optional.of(trip));when(orderRepo.findByIdForUpdate(9L)).thenReturn(Optional.of(order));
        var coordinator=new OrderWriteCoordinator(tripRepo,orderRepo,entityManager);assertSame(order,coordinator.existing(9L));
        var sequence=inOrder(orderRepo,tripRepo,entityManager);sequence.verify(orderRepo).locate(9L);sequence.verify(tripRepo).findByIdForUpdate(7L);
        sequence.verify(entityManager).refresh(trip,LockModeType.PESSIMISTIC_WRITE);sequence.verify(orderRepo).findByIdForUpdate(9L);sequence.verify(entityManager).refresh(order,LockModeType.PESSIMISTIC_WRITE);
        when(entityManager.find(Trip.class,7L)).thenReturn(trip);when(entityManager.getLockMode(trip)).thenReturn(LockModeType.PESSIMISTIC_WRITE);
        coordinator.trip(7L);verify(entityManager,times(1)).refresh(trip,LockModeType.PESSIMISTIC_WRITE);
    }
    @Test void optionalTripLockPreservesMissingUpdateContractButRequiredLockStillRejects() {
        var tripRepo=mock(TripRepository.class);var orderRepo=mock(OrderHeaderRepository.class);var entityManager=mock(EntityManager.class);
        when(tripRepo.findByIdForUpdate(99L)).thenReturn(Optional.empty());
        var coordinator=new OrderWriteCoordinator(tripRepo,orderRepo,entityManager);
        assertTrue(coordinator.tripIfPresent(99L).isEmpty());
        assertEquals(ErrorCode.RESOURCE_NOT_FOUND,assertThrows(ApiException.class,()->coordinator.trip(99L)).getErrorCode());
        verify(entityManager,never()).refresh(any(),any(LockModeType.class));
    }
    @Test void previewHashIsIdenticalAcrossRealStorageMapperAndSidecarReload() throws Exception {
        order.getLines().get(0).setBrand("Synthetic brand");order.getLines().get(0).setSaleUnit("pack");order.retainProductIdentities();
        var first=service.preview(authentication,9L);var original=order;
        var reloaded=json.readValue(json.writeValueAsBytes(original),OrderHeader.class);
        var storage=com.bobbuy.config.OrderStorageJsonConfiguration.storageMapper();
        var type=storage.getTypeFactory().constructCollectionType(List.class,OrderLine.class);
        reloaded.setLines(storage.readValue(storage.writeValueAsString(original.getLines()),type));
        assertNull(reloaded.getLines().get(0).getBrand());
        reloaded.retainProductIdentitiesFrom(original);order=reloaded;
        assertEquals("Synthetic brand",order.getLines().get(0).getBrand());
        var second=service.preview(authentication,9L);assertEquals(first.revision(),second.revision());assertEquals(first,second);
        verify(orders,never()).saveAndFlush(any());
    }
    @Test void queuedWriterDropsOnlyUnlockedAttachedVersionBeforeTakingFreshOrderLock() throws Exception {
        var tripRepo=mock(TripRepository.class);var orderRepo=mock(OrderHeaderRepository.class);var entityManager=mock(EntityManager.class);
        var stale=order;var fresh=new OrderHeader("SYNTHETIC-ORDER",2L,7L);fresh.setId(9L);setVersion(fresh,1L);
        when(entityManager.find(OrderHeader.class,9L)).thenReturn(stale);when(entityManager.getLockMode(stale)).thenReturn(LockModeType.NONE);
        var detached=new java.util.concurrent.atomic.AtomicBoolean();doAnswer(i->{detached.set(true);return null;}).when(entityManager).detach(stale);
        when(orderRepo.findByIdForUpdate(9L)).thenAnswer(i->{assertTrue(detached.get(),"locking an attached old version fails before refresh");return Optional.of(fresh);});
        var coordinator=new OrderWriteCoordinator(tripRepo,orderRepo,entityManager);assertSame(fresh,coordinator.order(9L));assertEquals(1L,fresh.getOrderRevision());
        var sequence=inOrder(entityManager,orderRepo);sequence.verify(entityManager).detach(stale);sequence.verify(orderRepo).findByIdForUpdate(9L);sequence.verify(entityManager).refresh(fresh,LockModeType.PESSIMISTIC_WRITE);
        when(entityManager.find(OrderHeader.class,9L)).thenReturn(fresh);when(entityManager.getLockMode(fresh)).thenReturn(LockModeType.PESSIMISTIC_WRITE);
        fresh.setStatus(OrderStatus.CONFIRMED);clearInvocations(entityManager,orderRepo);assertSame(fresh,coordinator.order(9L));assertEquals(OrderStatus.CONFIRMED,fresh.getStatus());
        verify(entityManager,never()).detach(any());verify(entityManager,never()).refresh(any(),any(LockModeType.class));verify(orderRepo,never()).findByIdForUpdate(anyLong());
    }
    @Test void bulkWriterRefreshesQueuedSnapshotsAndRetainsItsOwnLockedEdits() {
        var tripRepo=mock(TripRepository.class);var orderRepo=mock(OrderHeaderRepository.class);var entityManager=mock(EntityManager.class);
        var stale=order;var fresh=new OrderHeader("FRESH",2L,7L);fresh.setId(9L);var held=new OrderHeader("HELD",2L,7L);held.setId(10L);held.setStatus(OrderStatus.CONFIRMED);
        when(orderRepo.findByTripId(7L)).thenReturn(List.of(stale,held));when(orderRepo.findByTripIdForUpdate(7L)).thenReturn(List.of(fresh,held));when(entityManager.getLockMode(stale)).thenReturn(LockModeType.NONE);when(entityManager.getLockMode(held)).thenReturn(LockModeType.PESSIMISTIC_WRITE);
        var coordinator=new OrderWriteCoordinator(tripRepo,orderRepo,entityManager);assertEquals(List.of(fresh,held),coordinator.orders(7L));
        var sequence=inOrder(entityManager,orderRepo);sequence.verify(orderRepo).findByTripId(7L);sequence.verify(entityManager).detach(stale);sequence.verify(orderRepo).findByTripIdForUpdate(7L);sequence.verify(entityManager).refresh(fresh,LockModeType.PESSIMISTIC_WRITE);
        assertEquals(OrderStatus.CONFIRMED,held.getStatus());verify(entityManager,never()).detach(held);verify(entityManager,never()).refresh(held,LockModeType.PESSIMISTIC_WRITE);
    }
}
