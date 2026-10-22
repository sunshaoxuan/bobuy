package com.bobbuy.service;

import com.bobbuy.api.BobbuyApplication;
import com.bobbuy.api.response.ApiException;
import com.bobbuy.api.response.ErrorCode;
import com.bobbuy.model.User;
import com.bobbuy.model.Role;
import com.bobbuy.model.OrderHeader;
import com.bobbuy.model.OrderLine;
import com.bobbuy.model.OrderMethod;
import com.bobbuy.model.Product;
import com.bobbuy.model.ProductPatch;
import com.bobbuy.model.OrderStatus;
import com.bobbuy.model.StorageCondition;
import com.bobbuy.model.Trip;
import com.bobbuy.model.TripStatus;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(classes = BobbuyApplication.class)
class BobbuyStoreTest {
  @Autowired
  private BobbuyStore store;
  @Autowired
  private AuditLogService auditLogService;

  @BeforeEach
  void setUp() {
    store.seed();
  }

  @Test
  void userLifecycleTests() {
    // List
    assertThat(store.listUsers()).hasSize(2);

    // Create
    User newUser = new User(null, "Test User", Role.CUSTOMER, 5.0);
    User created = store.createUser(newUser);
    assertThat(created.getId()).isGreaterThanOrEqualTo(1000000L);
    assertThat(store.getUser(created.getId())).isPresent();

    // Update
    created.setName("Updated Name");
    Optional<User> updated = store.updateUser(created.getId(), created);
    assertThat(updated).isPresent();
    assertThat(updated.get().getName()).isEqualTo("Updated Name");

    // Update missing
    assertThat(store.updateUser(9999L, created)).isEmpty();

    // Delete
    assertThat(store.deleteUser(created.getId())).isTrue();
    assertThat(store.deleteUser(created.getId())).isFalse();
  }

  @Test
  void tripLifecycleTests() {
    // List
    assertThat(store.listTrips()).hasSize(1);

    // Create
    Trip newTrip = new Trip(null, 1000L, "HK", "NY", LocalDate.now(), 5, -1, TripStatus.DRAFT, null);
    Trip created = store.createTrip(newTrip);
    assertThat(created.getId()).isEqualTo(2001L);
    assertThat(created.getReservedCapacity()).isEqualTo(0); // Test Math.max logic

    // Update
    created.setOrigin("Macau");
    Optional<Trip> updated = store.updateTrip(2001L, created);
    assertThat(updated).isPresent();
    assertThat(updated.get().getOrigin()).isEqualTo("Macau");

    // Update missing
    assertThat(store.updateTrip(9999L, created)).isEmpty();

    // Update status missing
    assertThatThrownBy(() -> store.updateTripStatus(9999L, TripStatus.COMPLETED))
        .isInstanceOf(ApiException.class);

    // Delete
    assertThat(store.deleteTrip(2001L)).isTrue();
    assertThat(store.deleteTrip(2001L)).isFalse();
  }

  @Test
  void orderLifecycleAndCalculations() {
    // List & GMV (Seeded 1 order with 65.0 amount)
    assertThat(store.listOrders()).hasSize(1);
    assertThat(store.calculateGmv()).isEqualTo(65.0);

    // Create via upsert
    OrderHeader newHeader = new OrderHeader("BUS-X", 1001L, 2000L);
    newHeader.addLine(new OrderLine("SKU-X", "Tea", null, 1, 10.0));
    OrderHeader created = store.upsertOrder(newHeader);
    assertThat(created.getId()).isNotNull();
    assertThat(created.getTotalAmount()).isEqualTo(10.0);

    // Update status
    store.updateOrderStatus(created.getId(), OrderStatus.CONFIRMED);
    assertThat(store.getOrder(created.getId()).get().getStatus()).isEqualTo(OrderStatus.CONFIRMED);

    // Delete
    assertThat(store.deleteOrder(created.getId())).isTrue();
    assertThat(store.listOrders()).hasSize(1);
    assertThat(store.deleteOrder(created.getId())).isFalse();
  }

  @Test
  void updateOrderStatusReservesCapacityWhenConfirmed() {
    Trip tripBefore = store.getTrip(2000L).orElseThrow();
    int reservedBefore = tripBefore.getReservedCapacity();

    OrderHeader newHeader = new OrderHeader("BUS-CAP-1", 1001L, 2000L);
    newHeader.addLine(new OrderLine("SKU-CAP", "Capacity", null, 2, 10.0));
    OrderHeader created = store.upsertOrder(newHeader);

    store.updateOrderStatus(created.getId(), OrderStatus.CONFIRMED);

    Trip tripAfter = store.getTrip(2000L).orElseThrow();
    assertThat(tripAfter.getReservedCapacity()).isEqualTo(reservedBefore + 2);
  }

  @Test
  void upsertOrderReservesCapacityForConfirmedMerges() {
    Trip tripBefore = store.getTrip(2000L).orElseThrow();
    int reservedBefore = tripBefore.getReservedCapacity();

    OrderHeader confirmed = new OrderHeader("BUS-CAP-2", 1001L, 2000L);
    confirmed.setStatus(OrderStatus.CONFIRMED);
    confirmed.addLine(new OrderLine("SKU-CAP", "Capacity", null, 1, 10.0));
    store.upsertOrder(confirmed);

    Trip tripAfterCreate = store.getTrip(2000L).orElseThrow();
    assertThat(tripAfterCreate.getReservedCapacity()).isEqualTo(reservedBefore + 1);

    OrderHeader merged = new OrderHeader("BUS-CAP-2", 1001L, 2000L);
    merged.addLine(new OrderLine("SKU-CAP", "Capacity", null, 3, 10.0));
    store.upsertOrder(merged);

    Trip tripAfterMerge = store.getTrip(2000L).orElseThrow();
    assertThat(tripAfterMerge.getReservedCapacity()).isEqualTo(reservedBefore + 4);
  }

  @Test
  void idempotencyMergeTest() {
    String bizId = "BIZ-999";
    Long custId = 1001L;
    Long tripId = 2000L;

    // 1. First Submission: SKU-A x 2
    OrderHeader h1 = new OrderHeader(bizId, custId, tripId);
    h1.addLine(new OrderLine("SKU-A", "Item A", "Red", 2, 50.0));
    store.upsertOrder(h1);

    // 2. Second Submission (Idempotent): Repeat SKU-A x 1 -> Should merge to 3
    OrderHeader h2 = new OrderHeader(bizId, custId, tripId);
    h2.addLine(new OrderLine("SKU-A", "Item A", "Red", 1, 50.0));
    OrderHeader merged = store.upsertOrder(h2);

    assertThat(merged.getLines()).hasSize(1);
    assertThat(merged.getLines().get(0).getQuantity()).isEqualTo(3);
    assertThat(merged.getTotalAmount()).isEqualTo(150.0);

    // 3. Third Submission: Different SKU -> Should add new line
    OrderHeader h3 = new OrderHeader(bizId, custId, tripId);
    h3.addLine(new OrderLine("SKU-B", "Item B", null, 1, 20.0));
    OrderHeader withB = store.upsertOrder(h3);

    assertThat(withB.getLines()).hasSize(2);
    assertThat(withB.getTotalAmount()).isEqualTo(170.0);

    // 4. Fourth Submission: Same SKU but Different Spec (Green vs Red) -> Should
    // isolate
    OrderHeader h4 = new OrderHeader(bizId, custId, tripId);
    h4.addLine(new OrderLine("SKU-A", "Item A", "Green", 1, 50.0));
    OrderHeader withGreen = store.upsertOrder(h4);

    assertThat(withGreen.getLines()).hasSize(3); // A-Red(3), B(1), A-Green(1)
    assertThat(withGreen.getTotalAmount()).isEqualTo(220.0);
  }

  @Test
  void orderStatusCountsWithEmpty() {
    store.deleteOrder(3000L);
    assertThat(store.orderStatusCounts()).isEmpty();
  }

  @Test
  void listOrdersFiltersByTripId() {
    OrderHeader otherTrip = new OrderHeader("BIZ-TRIP", 1001L, 9999L);
    otherTrip.addLine(new OrderLine("SKU-T", "Tea", null, 1, 10.0));
    store.upsertOrder(otherTrip);

    assertThat(store.listOrders(2000L)).allMatch(order -> order.getTripId().equals(2000L));
    assertThat(store.listOrders(9999L)).allMatch(order -> order.getTripId().equals(9999L));
  }

  @Test
  void updateOrderUpdatesExistingAndRejectsMissing() {
    OrderHeader header = new OrderHeader("BIZ-UPDATE", 1001L, 2000L);
    header.addLine(new OrderLine("SKU-U", "Update", null, 1, 8.0));
    OrderHeader created = store.upsertOrder(header);

    OrderHeader updated = new OrderHeader(created.getBusinessId(), 1001L, 2000L);
    updated.setStatus(OrderStatus.CONFIRMED);
    assertThat(store.updateOrder(created.getId(), updated)).isPresent();
    assertThat(store.getOrder(created.getId()).orElseThrow().getStatus()).isEqualTo(OrderStatus.CONFIRMED);

    assertThat(store.updateOrder(9999L, updated)).isEmpty();
  }

  @Test
  void settlementFrozenTripBlocksOrderMutationAndDeletion() {
    Trip frozenTrip = store.updateTripStatus(2000L, TripStatus.COMPLETED);
    assertThat(frozenTrip.isSettlementFrozen()).isTrue();

    OrderHeader header = new OrderHeader("BIZ-FROZEN", 1001L, 2000L);
    header.addLine(new OrderLine("SKU-F", "Frozen", null, 1, 8.0));

    assertThatThrownBy(() -> store.upsertOrder(header))
        .isInstanceOf(ApiException.class)
        .satisfies(error -> assertThat(((ApiException) error).getMessageKey()).isEqualTo("error.trip.settlement_frozen"));

    OrderHeader existing = store.getOrder(3000L).orElseThrow();
    assertThatThrownBy(() -> store.updateOrder(existing.getId(), existing))
        .isInstanceOf(ApiException.class)
        .satisfies(error -> assertThat(((ApiException) error).getMessageKey()).isEqualTo("error.trip.settlement_frozen"));

    assertThatThrownBy(() -> store.deleteOrder(existing.getId()))
        .isInstanceOf(ApiException.class)
        .satisfies(error -> assertThat(((ApiException) error).getMessageKey()).isEqualTo("error.trip.settlement_frozen"));
  }

  @Test
  void getOrderByBusinessIdReturnsOptional() {
    assertThat(store.getOrderByBusinessId("20260117001")).isPresent();
    assertThat(store.getOrderByBusinessId("MISSING")).isEmpty();
  }

  @Test
  void updateOrderStatusRejectsInvalidTransitions() {
    OrderHeader header = new OrderHeader("BIZ-INVALID", 1001L, 2000L);
    header.addLine(new OrderLine("SKU-I", "Invalid", null, 1, 8.0));
    OrderHeader created = store.upsertOrder(header);

    assertThatThrownBy(() -> store.updateOrderStatus(created.getId(), OrderStatus.PURCHASED))
        .isInstanceOf(ApiException.class)
        .satisfies(error -> {
          ApiException ex = (ApiException) error;
          assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.INVALID_STATUS);
        });

    created.setStatus(OrderStatus.CONFIRMED);
    store.updateOrder(created.getId(), created);
    assertThatThrownBy(() -> store.updateOrderStatus(created.getId(), OrderStatus.DELIVERED))
        .isInstanceOf(ApiException.class);

    created.setStatus(OrderStatus.PURCHASED);
    store.updateOrder(created.getId(), created);
    assertThatThrownBy(() -> store.updateOrderStatus(created.getId(), OrderStatus.SETTLED))
        .isInstanceOf(ApiException.class);
    assertThatThrownBy(() -> store.updateOrderStatus(created.getId(), OrderStatus.CANCELLED))
        .isInstanceOf(ApiException.class);

    created.setStatus(OrderStatus.DELIVERED);
    store.updateOrder(created.getId(), created);
    assertThatThrownBy(() -> store.updateOrderStatus(created.getId(), OrderStatus.CONFIRMED))
        .isInstanceOf(ApiException.class);

    created.setStatus(OrderStatus.SETTLED);
    store.updateOrder(created.getId(), created);
    assertThatThrownBy(() -> store.updateOrderStatus(created.getId(), OrderStatus.NEW))
        .isInstanceOf(ApiException.class);
  }

  @Test
  void reserveTripCapacityNotFound() {
    assertThatThrownBy(() -> store.reserveTripCapacity(9999L, 1))
        .isInstanceOf(ApiException.class);
  }

  @Test
  void updatesOrderStatusAndLogsCounts() {
    store.updateOrderStatus(3000L, OrderStatus.CONFIRMED);
    assertThat(store.orderStatusCounts().get(OrderStatus.CONFIRMED)).isEqualTo(1);
  }

  @Test
  void reserveTripCapacityRejectsWhenCapacityInsufficient() {
    assertThatThrownBy(() -> store.reserveTripCapacity(2000L, 99))
        .isInstanceOf(ApiException.class)
        .satisfies(error -> {
          ApiException ex = (ApiException) error;
          assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.CAPACITY_NOT_ENOUGH);
          assertThat(ex.getMessageKey()).isEqualTo("error.trip.capacity_not_enough");
        });
  }

  @Test
  void updateOrderStatusRejectsMissingOrder() {
    assertThatThrownBy(() -> store.updateOrderStatus(9999L, OrderStatus.CONFIRMED))
        .isInstanceOf(ApiException.class)
        .satisfies(error -> {
          ApiException ex = (ApiException) error;
          assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.RESOURCE_NOT_FOUND);
          assertThat(ex.getMessageKey()).isEqualTo("error.order.not_found");
        });
  }

  @Test
  void reserveTripCapacityRejectsInvalidQuantity() {
    assertThatThrownBy(() -> store.reserveTripCapacity(2000L, 0))
        .isInstanceOf(ApiException.class)
        .satisfies(error -> {
          ApiException ex = (ApiException) error;
          assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST);
          assertThat(ex.getMessageKey()).isEqualTo("error.trip.invalid_quantity");
        });

    assertThatThrownBy(() -> store.reserveTripCapacity(2000L, -2))
        .isInstanceOf(ApiException.class)
        .satisfies(error -> {
          ApiException ex = (ApiException) error;
          assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST);
          assertThat(ex.getMessageKey()).isEqualTo("error.trip.invalid_quantity");
        });
  }

  @Test
  void reserveTripCapacityAllowsExactRemainingCapacity() {
    Trip trip = store.reserveTripCapacity(2000L, 5);
    assertThat(trip.getRemainingCapacity()).isEqualTo(0);
  }

  @Test
  void cancelOrderReleasesReservedCapacity() {
    Trip before = store.getTrip(2000L).orElseThrow();
    int reservedBefore = before.getReservedCapacity();

    OrderHeader header = new OrderHeader("BIZ-CANCEL", 1001L, 2000L);
    header.setStatus(OrderStatus.CONFIRMED);
    header.addLine(new OrderLine("SKU-C", "Cancel Item", null, 2, 10.0));
    OrderHeader created = store.upsertOrder(header);

    Trip afterConfirm = store.getTrip(2000L).orElseThrow();
    assertThat(afterConfirm.getReservedCapacity()).isEqualTo(reservedBefore + 2);

    store.updateOrderStatus(created.getId(), OrderStatus.CANCELLED);
    Trip afterCancel = store.getTrip(2000L).orElseThrow();
    assertThat(afterCancel.getReservedCapacity()).isEqualTo(reservedBefore);
  }

  @Test
  void cancelFromNewDoesNotReleaseCapacity() {
    Trip before = store.getTrip(2000L).orElseThrow();
    int reservedBefore = before.getReservedCapacity();

    OrderHeader header = new OrderHeader("BIZ-CANCEL-NEW", 1001L, 2000L);
    header.addLine(new OrderLine("SKU-N", "New Item", null, 1, 5.0));
    OrderHeader created = store.upsertOrder(header);

    store.updateOrderStatus(created.getId(), OrderStatus.CANCELLED);
    Trip afterCancel = store.getTrip(2000L).orElseThrow();
    assertThat(afterCancel.getReservedCapacity()).isEqualTo(reservedBefore);
  }

  @Test
  void procurementListAggregatesBySku() {
    OrderHeader first = new OrderHeader("BIZ-PROC-1", 1001L, 2000L);
    first.addLine(new OrderLine("SKU-P", "Proc Item", null, 2, 10.0));
    store.upsertOrder(first);

    OrderHeader second = new OrderHeader("BIZ-PROC-2", 1001L, 2000L);
    second.addLine(new OrderLine("SKU-P", "Proc Item", null, 3, 10.0));
    store.upsertOrder(second);

    List<com.bobbuy.api.ProcurementItemResponse> list = store.getProcurementList(2000L);
    assertThat(list).anyMatch(item ->
        item.getSkuId().equals("SKU-P")
            && item.getTotalQuantity() == 5
            && item.getBusinessIds().contains("BIZ-PROC-1")
            && item.getBusinessIds().contains("BIZ-PROC-2"));
  }

  @Test
  void reserveTripCapacityPreventsOverbookingUnderConcurrency() throws InterruptedException {
    ExecutorService executor = Executors.newFixedThreadPool(10);
    CountDownLatch latch = new CountDownLatch(10);
    AtomicInteger successCount = new AtomicInteger(0);

    try {
      for (int i = 0; i < 10; i++) {
        executor.submit(() -> {
          try {
            store.reserveTripCapacity(2000L, 1);
            successCount.incrementAndGet();
          } catch (ApiException ignored) {
            // Expected for some threads due to capacity limit.
          } finally {
            latch.countDown();
          }
        });
      }
      assertThat(latch.await(5, TimeUnit.SECONDS)).isTrue();
    } finally {
      executor.shutdownNow();
    }

    assertThat(successCount.get()).isLessThanOrEqualTo(5);
    assertThat(store.getTrip(2000L).orElseThrow().getRemainingCapacity()).isGreaterThanOrEqualTo(0);
  }

  @Test
  void updateTripStatusCreatesAuditLogEntry() {
    int before = auditLogService.listLogs().size();
    store.updateTripStatus(2000L, com.bobbuy.model.TripStatus.IN_PROGRESS);
    assertThat(auditLogService.listLogs().size()).isEqualTo(before + 1);
    assertThat(auditLogService.listLogs().get(before).getEntityType()).isEqualTo("TRIP");
  }

  @Test
  void productPatchMergesLocalizedFieldsAndKeepsExistingValues() {
    Product seeded = store.getProduct("prd-1000").orElseThrow();
    assertThat(seeded.getName()).containsEntry("zh-CN", "抹茶套装");
    assertThat(seeded.getMerchantSkus()).containsEntry("sup-1000", "TOKYO-MATCHA-001");

    ProductPatch patch = new ProductPatch();
    patch.setName(Map.of("en-US", "Matcha Kit Pro", "ja-JP", "抹茶キット"));
    patch.setDescription(Map.of("en-US", "Kyoto style matcha combo"));

    Product updated = store.patchProduct("prd-1000", patch).orElseThrow();
    assertThat(updated.getName()).containsEntry("zh-CN", "抹茶套装");
    assertThat(updated.getName()).containsEntry("en-US", "Matcha Kit Pro");
    assertThat(updated.getName()).containsEntry("ja-JP", "抹茶キット");
    assertThat(updated.getDescription()).containsEntry("zh-CN", "京都风味抹茶组合");
    assertThat(updated.getDescription()).containsEntry("en-US", "Kyoto style matcha combo");
  }

  @Test
  void productMasterDataCrudAndLookupCoverage() {
    assertThat(store.listProducts()).isNotEmpty();
    assertThat(store.listCategories()).isNotEmpty();
    assertThat(store.listSuppliers()).isNotEmpty();
    assertThat(store.listMerchantSkus()).isNotEmpty();
    assertThat(store.getCategory("cat-1000")).isPresent();
    assertThat(store.getSupplier("sup-1000")).isPresent();
    assertThat(store.getMerchantSku("msku-1000")).isPresent();
    assertThat(store.getMerchantSku("missing")).isEmpty();

    Product draft = new Product();
    draft.setBrand("Draft");
    Product created = store.createProduct(draft);
    assertThat(created.getId()).isNotBlank();
    assertThat(created.getName()).isEmpty();
    assertThat(created.getDescription()).isEmpty();

    Product replaced = new Product();
    replaced.setName(Map.of("en-US", "Updated"));
    replaced.setDescription(Map.of("en-US", "Updated desc"));
    replaced.setBrand("Updated Brand");
    replaced.setBasePrice(88.8);
    replaced.setStorageCondition(StorageCondition.FRESH);
    replaced.setOrderMethod(OrderMethod.PRE_ORDER);
    assertThat(store.updateProduct(created.getId(), replaced)).isPresent();
    assertThat(store.updateProduct("missing", replaced)).isEmpty();

    ProductPatch nullPatch = null;
    assertThat(store.patchProduct(created.getId(), nullPatch)).isPresent();
    assertThat(store.patchProduct("missing", new ProductPatch())).isEmpty();

    ProductPatch patch = new ProductPatch();
    HashMap<String, String> removeEnAndAddZh = new HashMap<>();
    removeEnAndAddZh.put("en-US", null);
    removeEnAndAddZh.put("zh-CN", "更新商品");
    patch.setName(removeEnAndAddZh);
    patch.setDescription(Map.of("zh-CN", "更新描述"));
    patch.setBrand("Patched Brand");
    patch.setBasePrice(66.6);
    patch.setStorageCondition(StorageCondition.CHILLED);
    patch.setOrderMethod(OrderMethod.DIRECT_BUY);
    patch.setCategoryId("cat-1000");
    patch.setMerchantSkus(Map.of("sup-1000", "TOKYO-MATCHA-002", "sup-2000", "TOKYO-MATCHA-003"));
    Product patched = store.patchProduct(created.getId(), patch).orElseThrow();
    assertThat(patched.getName()).doesNotContainKey("en-US");
    assertThat(patched.getName()).containsEntry("zh-CN", "更新商品");
    assertThat(patched.getDescription()).containsEntry("zh-CN", "更新描述");
    assertThat(patched.getBrand()).isEqualTo("Patched Brand");
    assertThat(patched.getMerchantSkus()).containsEntry("sup-1000", "TOKYO-MATCHA-002");
  }

  @Test
  void preOrderSupportsNullTripAndDesiredDeliveryWindow() {
    OrderHeader preOrder = new OrderHeader("BIZ-PRE-1", 1001L, null);
    preOrder.setDesiredDeliveryWindow("2026-05-01~2026-05-07");
    preOrder.addLine(new OrderLine("SKU-PRE", "Pre Item", null, 1, 15.0));

    OrderHeader created = store.upsertOrder(preOrder);
    assertThat(created.getTripId()).isNull();
    assertThat(created.getDesiredDeliveryWindow()).isEqualTo("2026-05-01~2026-05-07");
  }

  @Test
  void completedTripLocksOrderLineMutations() {
    OrderHeader order = new OrderHeader("BIZ-LOCK-1", 1001L, 2000L);
    order.addLine(new OrderLine("SKU-L", "Lock Item", null, 1, 9.9));
    OrderHeader created = store.upsertOrder(order);
    store.updateTripStatus(2000L, TripStatus.COMPLETED);

    OrderHeader updatePayload = new OrderHeader(created.getBusinessId(), 1001L, 2000L);
    updatePayload.addLine(new OrderLine("SKU-L", "Lock Item", null, 2, 9.9));
    assertThatThrownBy(() -> store.updateOrder(created.getId(), updatePayload))
        .isInstanceOf(ApiException.class)
        .satisfies(error -> assertThat(((ApiException) error).getMessageKey()).isEqualTo("error.trip.settlement_frozen"));

    assertThatThrownBy(() -> store.deleteOrder(created.getId()))
        .isInstanceOf(ApiException.class)
        .satisfies(error -> assertThat(((ApiException) error).getMessageKey()).isEqualTo("error.trip.settlement_frozen"));
  }

  @Test
  void listProductsPrioritizesRecommendedThenLatestUpdated() {
    Product first = new Product();
    first.setName(Map.of("en-US", "First"));
    first.setRecommended(false);
    Product createdFirst = store.createProduct(first);

    Product second = new Product();
    second.setName(Map.of("en-US", "Second"));
    second.setRecommended(false);
    Product createdSecond = store.createProduct(second);

    ProductPatch patch = new ProductPatch();
    patch.setIsRecommended(true);
    store.patchProduct(createdSecond.getId(), patch);

    List<Product> sorted = store.listProducts();
    assertThat(sorted.get(0).isRecommended()).isTrue();
    assertThat(sorted.get(0).getId()).isEqualTo(createdSecond.getId());
    assertThat(sorted.stream().map(Product::getId)).contains(createdFirst.getId());
  }
}
