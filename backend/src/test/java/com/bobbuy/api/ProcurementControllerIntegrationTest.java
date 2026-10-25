package com.bobbuy.api;

import com.bobbuy.model.OrderHeader;
import com.bobbuy.model.OrderLine;
import com.bobbuy.model.Trip;
import com.bobbuy.model.TripStatus;
import com.bobbuy.security.RoleInjectionFilter;
import com.bobbuy.service.BobbuyStore;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDate;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@AutoConfigureMockMvc
class ProcurementControllerIntegrationTest {
  private static final String AGENT_ROLE = "AGENT";
  private static final String AGENT_USER = "1000";

  @Autowired
  private MockMvc mockMvc;

  @Autowired
  private BobbuyStore store;
  @Autowired
  private ObjectMapper objectMapper;

  @Autowired
  private com.bobbuy.repository.TripRepository trips;

  private void freezeTrip(Long id, TripStatus status) {
    Trip trip = trips.findById(id).orElseThrow();
    trip.setStatus(status);
    trips.saveAndFlush(trip);
  }

  @BeforeEach
  void setUp() {
    store.seed();
  }

  @Test
  void hudReturnsRealtimeProfitAndCategoryCompletion() throws Exception {
    Trip trip = store.createTrip(new Trip(null, 1000L, "NY", LocalDate.now(), TripStatus.PUBLISHED, null));
    OrderHeader order = new OrderHeader("HUD-1", 1001L, trip.getId());
    OrderLine line = new OrderLine("prd-1000", "Matcha", null, 4, 32.5);
    line.setPurchasedQuantity(1);
    order.addLine(line);
    store.upsertOrder(order);

    mockMvc.perform(asAgent(get("/api/procurement/{tripId}/hud", trip.getId())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.totalEstimatedProfit").value(97.5))
        .andExpect(jsonPath("$.data.currentPurchasedAmount").value(32.5))
        .andExpect(jsonPath("$.data.currentFxRate").value(1.0))
        .andExpect(jsonPath("$.data.referenceFxRate").value(1.0))
        .andExpect(jsonPath("$.data.totalTripExpenses").value(0.0))
        .andExpect(jsonPath("$.data.currentWeight").value(0.5))
        .andExpect(jsonPath("$.data.currentVolume").value(0.2))
        .andExpect(jsonPath("$.data.categoryCompletionPercent.cat-1000").value(25.0));
  }

  @Test
  void deficitReturnsMissingItemsWithPriority() throws Exception {
    Trip trip = store.createTrip(new Trip(null, 1000L, "NY", LocalDate.now(), TripStatus.PUBLISHED, null));
    OrderHeader order = new OrderHeader("DEFICIT-1", 1001L, trip.getId());
    OrderLine line = new OrderLine("prd-1000", "Matcha", null, 4, 32.5);
    line.setPurchasedQuantity(1);
    order.addLine(line);
    store.upsertOrder(order);

    mockMvc.perform(asAgent(get("/api/procurement/{tripId}/deficit", trip.getId())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.meta.total").value(1))
        .andExpect(jsonPath("$.data[0].skuId").value("prd-1000"))
        .andExpect(jsonPath("$.data[0].deficitQuantity").value(3))
        .andExpect(jsonPath("$.data[0].completionPercent").value(25.0))
        .andExpect(jsonPath("$.data[0].priority").value("HIGH"));
  }

  @Test
  void expensesEndpointCreatesAndListsTripExpense() throws Exception {
    Trip trip = store.createTrip(new Trip(null, 1000L, "NY", LocalDate.now(), TripStatus.PUBLISHED, null));

    MvcResult createResult = mockMvc.perform(asAgent(post("/api/procurement/{tripId}/expenses", trip.getId())
            .contentType("application/json")
            .content("""
                {"category":"停车费","cost":12.5}
                """)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.category").value("停车费"))
        .andExpect(jsonPath("$.data.cost").value(12.5))
        .andReturn();
    JsonNode createdPayload = objectMapper.readTree(createResult.getResponse().getContentAsString());
    long expenseId = createdPayload.path("data").path("id").asLong();

    mockMvc.perform(asAgent(get("/api/procurement/{tripId}/expenses", trip.getId())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.meta.total").value(1))
        .andExpect(jsonPath("$.data[0].category").value("停车费"))
        .andExpect(jsonPath("$.data[0].cost").value(12.5))
        .andExpect(jsonPath("$.data[0].ocrStatus").value("NOT_UPLOADED"));

    mockMvc.perform(asAgent(get("/api/procurement/{tripId}/expenses/{expenseId}/receipt-preview", trip.getId(), expenseId)))
        .andExpect(status().isNotFound());
  }

  @Test
  void exportEndpointReturnsCsvAndPdf() throws Exception {
    Trip trip = store.createTrip(new Trip(null, 1000L, "NY", LocalDate.now(), TripStatus.PUBLISHED, null));

    mockMvc.perform(asAgent(get("/api/procurement/{tripId}/export?format=csv", trip.getId())))
        .andExpect(status().isOk())
        .andExpect(header().string("Content-Type", org.hamcrest.Matchers.containsString("text/csv")))
        .andExpect(content().string(org.hamcrest.Matchers.containsString("tripId,currentFxRate")));

    mockMvc.perform(asAgent(get("/api/procurement/{tripId}/export?format=pdf", trip.getId())))
        .andExpect(status().isOk())
        .andExpect(header().string("Content-Type", org.hamcrest.Matchers.containsString("application/pdf")))
        .andExpect(result -> assertThat(result.getResponse().getContentAsByteArray().length).isGreaterThan(0));
  }

  @Test
  void auditLogAndLedgerEndpointsReturnFinancialData() throws Exception {
    Trip trip = store.createTrip(new Trip(null, 1000L, "NY", LocalDate.now(), TripStatus.PUBLISHED, null));
    OrderHeader fromOrder = new OrderHeader("LEDGER-FROM", 1001L, trip.getId());
    OrderLine fromLine = new OrderLine("prd-1000", "抹茶セット", null, 3, 10.0);
    fromLine.setPurchasedQuantity(2);
    fromOrder.addLine(fromLine);
    fromOrder.setStatus(com.bobbuy.model.OrderStatus.CONFIRMED);
    store.upsertOrder(fromOrder);

    OrderHeader toOrder = new OrderHeader("LEDGER-TO", 1001L, trip.getId());
    toOrder.addLine(new OrderLine("prd-1000", "抹茶セット", null, 3, 10.0));
    toOrder.setStatus(com.bobbuy.model.OrderStatus.CONFIRMED);
    store.upsertOrder(toOrder);

    mockMvc.perform(asAgent(post("/api/procurement/{tripId}/expenses", trip.getId())
            .contentType("application/json")
            .content("""
                {"category":"停车费","cost":12.5}
                """)))
        .andExpect(status().isOk());

    mockMvc.perform(asAgent(post("/api/procurement/{tripId}/manual-reconcile", trip.getId())
            .contentType("application/json")
            .content("""
                {"skuId":"prd-1000","fromBusinessId":"LEDGER-FROM","toBusinessId":"LEDGER-TO","quantity":1}
                """)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.transferredQuantity").value(1));

    mockMvc.perform(asAgent(get("/api/procurement/{tripId}/ledger", trip.getId())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.meta.total").value(2))
        .andExpect(jsonPath("$.data[0].businessId").value("LEDGER-FROM"))
        .andExpect(jsonPath("$.data[0].totalReceivable").value(10.0))
        .andExpect(jsonPath("$.data[0].amountDueThisTrip").value(10.0));

    mockMvc.perform(asAgent(get("/api/procurement/{tripId}/audit-logs", trip.getId())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.meta.total").value(2))
        .andExpect(jsonPath("$.data[0].actionType").exists())
        .andExpect(jsonPath("$.data[0].currentHash").exists());
  }

  @Test
  void customerStatementPdfEndpointReturnsDocument() throws Exception {
    Trip trip = store.createTrip(new Trip(null, 1000L, "NY", LocalDate.now(), TripStatus.PUBLISHED, null));
    OrderHeader order = new OrderHeader("CUST-PDF-1", 1001L, trip.getId());
    order.addLine(new OrderLine("prd-1000", "抹茶セット", null, 2, 32.5));
    store.upsertOrder(order);

    mockMvc.perform(asAgent(get("/api/procurement/{tripId}/customers/{businessId}/statement", trip.getId(), "CUST-PDF-1")))
        .andExpect(status().isOk())
        .andExpect(header().string("Content-Type", org.hamcrest.Matchers.containsString("application/pdf")))
        .andExpect(result -> assertThat(result.getResponse().getContentAsByteArray().length).isGreaterThan(0));
  }

  @Test
  void customerCanConfirmReceiptAndBillingForOwnLedger() throws Exception {
    store.getOrderByBusinessId("20260117001").ifPresent(order -> {
      order.setStatus(com.bobbuy.model.OrderStatus.CONFIRMED);
      store.updateOrder(order.getId(), order);
    });
    mockMvc.perform(asCustomer(post("/api/procurement/{tripId}/ledger/{businessId}/confirm", 2000L, "20260117001")
            .contentType("application/json")
            .content("""
                {"action":"RECEIPT"}
                """), "1001"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.receiptConfirmedBy").value("1001"))
        .andExpect(jsonPath("$.data.settlementStatus").value("RECEIPT_CONFIRMED"));

    mockMvc.perform(asCustomer(post("/api/procurement/{tripId}/ledger/{businessId}/confirm", 2000L, "20260117001")
            .contentType("application/json")
            .content("""
                {"action":"BILLING"}
                """), "1001"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.billingConfirmedBy").value("1001"))
        .andExpect(jsonPath("$.data.settlementStatus").value("BILLING_CONFIRMED"));
  }

  @Test
  void receiptWorkbenchEndpointsUploadAndSaveReconciliation() throws Exception {
    Trip trip = store.createTrip(new Trip(null, 1000L, "NY", LocalDate.now(), TripStatus.PUBLISHED, null));

    mockMvc.perform(asAgent(post("/api/procurement/{tripId}/receipts", trip.getId())
            .contentType("application/json")
            .content("""
                {"receipts":[{"fileName":"receipt-1.jpg","imageBase64":"data:image/jpeg;base64,aGVsbG8="}]}
                """)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.meta.total").value(1))
        .andExpect(jsonPath("$.data[0].processingStatus").value("READY_FOR_REVIEW"))
        .andExpect(jsonPath("$.data[0].reconciliationResult.recognitionMode").value("RULE_FALLBACK"))
        .andExpect(jsonPath("$.data[0].rawRecognitionResult.reviewStatus").value("PENDING_REVIEW"))
        .andExpect(jsonPath("$.data[0].reconciliationResult.receiptItems").isArray());

    MvcResult listResult = mockMvc.perform(asAgent(get("/api/procurement/{tripId}/receipts", trip.getId())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.meta.total").value(1))
        .andReturn();
    long receiptId = objectMapper.readTree(listResult.getResponse().getContentAsString()).path("data").get(0).path("id").asLong();

    mockMvc.perform(asAgent(patch("/api/procurement/{tripId}/receipts/{receiptId}", trip.getId(), receiptId)
            .contentType("application/json")
            .content("""
                {"processingStatus":"RECONCILED","reconciliationResult":{"receiptItems":[],"matchedOrderLines":[],"unmatchedReceiptItems":[{"name":"补货","quantity":1,"disposition":"ON_SITE_REPLENISHED"}],"missingOrderedItems":[],"selfUseItems":[{"name":"自购饮料","quantity":1}]}}
                """)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.processingStatus").value("RECONCILED"))
        .andExpect(jsonPath("$.data.reconciliationResult.selfUseItems[0].name").value("自购饮料"))
        .andExpect(jsonPath("$.data.reconciliationResult.reviewStatus").value("REVIEWED"))
        .andExpect(jsonPath("$.data.manualReconciliationResult.reviewedBy").value(AGENT_USER));

    mockMvc.perform(asAgent(post("/api/procurement/{tripId}/receipts/{receiptId}/re-recognize", trip.getId(), receiptId)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.processingStatus").value("READY_FOR_REVIEW"))
        .andExpect(jsonPath("$.data.rawRecognitionResult.reviewStatus").value("PENDING_REVIEW"));
  }

  @Test
  void offlinePaymentEndpointsReturnTripAndCustomerBalances() throws Exception {
    long customerId = 9001L;
    Trip trip = store.createTrip(new Trip(null, 1000L, "NY", LocalDate.now(), TripStatus.PUBLISHED, null));
    OrderHeader order = new OrderHeader("PAY-100", customerId, trip.getId());
    order.addLine(new OrderLine("prd-1000", "抹茶セット", null, 2, 10.0));
    order.setStatus(com.bobbuy.model.OrderStatus.CONFIRMED);
    store.upsertOrder(order);

    mockMvc.perform(asAgent(post("/api/procurement/{tripId}/payments", trip.getId())
            .contentType("application/json")
            .content("""
                {"businessId":"PAY-100","amount":12.5,"paymentMethod":"CASH","note":"柜台现金"}
                """)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.businessId").value("PAY-100"))
        .andExpect(jsonPath("$.data.amount").value(12.5));

    mockMvc.perform(asAgent(get("/api/procurement/{tripId}/ledger", trip.getId())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].businessId").value("PAY-100"))
        .andExpect(jsonPath("$.data[0].amountReceivedThisTrip").value(12.5))
        .andExpect(jsonPath("$.data[0].amountPendingThisTrip").value(7.5))
        .andExpect(jsonPath("$.data[0].paymentRecords[0].paymentMethod").value("CASH"));

    mockMvc.perform(asAgent(get("/api/procurement/{tripId}/ledger/{businessId}/payments", trip.getId(), "PAY-100")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.meta.total").value(1))
        .andExpect(jsonPath("$.data[0].note").value("柜台现金"));

    mockMvc.perform(asAgent(get("/api/procurement/customers/{customerId}/balance", customerId)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.customerId").value(customerId))
        .andExpect(jsonPath("$.data.currentBalance").value(-7.5));

    mockMvc.perform(asAgent(get("/api/procurement/customers/{customerId}/ledger-history", customerId)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.meta.total").value(1))
        .andExpect(jsonPath("$.data[0].businessId").value("PAY-100"));
  }

  @Test
  void offlinePaymentRejectsInvalidPayload() throws Exception {
    Trip trip = store.createTrip(new Trip(null, 1000L, "NY", LocalDate.now(), TripStatus.PUBLISHED, null));
    OrderHeader order = new OrderHeader("PAY-INVALID", 1001L, trip.getId());
    order.addLine(new OrderLine("prd-1000", "抹茶セット", null, 1, 10.0));
    store.upsertOrder(order);

    mockMvc.perform(asAgent(post("/api/procurement/{tripId}/payments", trip.getId())
            .contentType("application/json")
            .content("""
                {"businessId":"PAY-INVALID","amount":0,"paymentMethod":""}
                """)))
        .andExpect(status().isBadRequest());
  }

  @Test
  void offlinePaymentRejectsUnsupportedMethod() throws Exception {
    Trip trip = store.createTrip(new Trip(null, 1000L, "NY", LocalDate.now(), TripStatus.PUBLISHED, null));
    OrderHeader order = new OrderHeader("PAY-METHOD", 1001L, trip.getId());
    order.addLine(new OrderLine("prd-1000", "抹茶セット", null, 1, 10.0));
    order.setStatus(com.bobbuy.model.OrderStatus.CONFIRMED);
    store.upsertOrder(order);

    mockMvc.perform(asAgent(post("/api/procurement/{tripId}/payments", trip.getId())
            .contentType("application/json")
            .content("""
                {"businessId":"PAY-METHOD","amount":10,"paymentMethod":"ALIPAY"}
                """)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errorCode").value("INVALID_REQUEST"));
  }

  @Test
  void settledTripRejectsOfflinePaymentAndReceiptReviewMutation() throws Exception {
    Trip trip = store.createTrip(new Trip(null, 1000L, "NY", LocalDate.now(), TripStatus.PUBLISHED, null));
    OrderHeader order = new OrderHeader("PAY-SETTLED", 1001L, trip.getId());
    order.addLine(new OrderLine("prd-1000", "抹茶セット", null, 1, 10.0));
    order.setStatus(com.bobbuy.model.OrderStatus.CONFIRMED);
    store.upsertOrder(order);

    MvcResult uploadResult = mockMvc.perform(asAgent(post("/api/procurement/{tripId}/receipts", trip.getId())
            .contentType("application/json")
            .content("""
                {"receipts":[{"fileName":"receipt-locked.jpg","imageBase64":"data:image/jpeg;base64,aGVsbG8="}]}
                """)))
        .andExpect(status().isOk())
        .andReturn();
    long receiptId = objectMapper.readTree(uploadResult.getResponse().getContentAsString()).path("data").get(0).path("id").asLong();
    freezeTrip(trip.getId(), TripStatus.SETTLED);

    mockMvc.perform(asAgent(post("/api/procurement/{tripId}/payments", trip.getId())
            .contentType("application/json")
            .content("""
                {"businessId":"PAY-SETTLED","amount":10,"paymentMethod":"BANK_TRANSFER"}
                """)))
        .andExpect(status().isBadRequest());

    mockMvc.perform(asAgent(patch("/api/procurement/{tripId}/receipts/{receiptId}", trip.getId(), receiptId)
            .contentType("application/json")
            .content("""
                {"processingStatus":"RECONCILED","reconciliationResult":{"receiptItems":[],"matchedOrderLines":[],"unmatchedReceiptItems":[],"missingOrderedItems":[],"selfUseItems":[]}}
                """)))
        .andExpect(status().isBadRequest());

    mockMvc.perform(asAgent(post("/api/procurement/{tripId}/receipts/{receiptId}/re-recognize", trip.getId(), receiptId)))
        .andExpect(status().isBadRequest());
  }

  @Test
  void completedTripAllowsConfirmationAndRejectsProcurementMutation() throws Exception {
    Trip trip = store.createTrip(new Trip(null, 1000L, "NY", LocalDate.now(), TripStatus.IN_PROGRESS, null));
    OrderHeader order = new OrderHeader("FROZEN-OPS", 1001L, trip.getId());
    OrderLine line = new OrderLine("prd-1000", "抹茶セット", null, 1, 10.0);
    line.setPurchasedQuantity(1);
    order.addLine(line);
    order.setStatus(com.bobbuy.model.OrderStatus.CONFIRMED);
    store.upsertOrder(order);

    MvcResult uploadResult = mockMvc.perform(asAgent(post("/api/procurement/{tripId}/receipts", trip.getId())
            .contentType("application/json")
            .content("""
                {"receipts":[{"fileName":"receipt-pick.jpg","imageBase64":"data:image/jpeg;base64,aGVsbG8="}]}
                """)))
        .andExpect(status().isOk())
        .andReturn();
    long receiptId = objectMapper.readTree(uploadResult.getResponse().getContentAsString()).path("data").get(0).path("id").asLong();

    mockMvc.perform(asAgent(patch("/api/procurement/{tripId}/receipts/{receiptId}", trip.getId(), receiptId)
            .contentType("application/json")
            .content("""
                {"processingStatus":"RECONCILED","reconciliationResult":{"reviewStatus":"REVIEWED","receiptItems":[],"matchedOrderLines":[{"businessId":"FROZEN-OPS","skuId":"prd-1000","matchedQuantity":1}],"unmatchedReceiptItems":[],"missingOrderedItems":[],"selfUseItems":[]}}
                """)))
        .andExpect(status().isOk());

    freezeTrip(trip.getId(), TripStatus.COMPLETED);

    mockMvc.perform(asCustomer(post("/api/procurement/{tripId}/ledger/{businessId}/confirm", trip.getId(), "FROZEN-OPS")
            .contentType("application/json")
            .content("""
                {"action":"RECEIPT"}
                """), "1001"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.settlementFrozen").value(false));

    mockMvc.perform(asAgent(post("/api/procurement/{tripId}/receipts", trip.getId())
            .contentType("application/json")
            .content("""
                {"receipts":[{"fileName":"receipt-locked.jpg","imageBase64":"data:image/jpeg;base64,aGVsbG8="}]}
                """)))
        .andExpect(status().isBadRequest());

    mockMvc.perform(asAgent(patch("/api/procurement/{tripId}/picking/{businessId}", trip.getId(), "FROZEN-OPS")
            .contentType("application/json")
            .content("""
                {"skuId":"prd-1000","checked":true}
                """)))
        .andExpect(status().isBadRequest());
  }

  @Test
  void balanceSummaryAndLedgerExcludesNewAndCancelledOrders() throws Exception {
    long customerId = 9010L;
    Trip trip = store.createTrip(new Trip(null, 1000L, "NY", LocalDate.now().minusDays(1), TripStatus.PUBLISHED, null));

    OrderHeader confirmedOrder = new OrderHeader("BAL-CONFIRMED", customerId, trip.getId());
    confirmedOrder.addLine(new OrderLine("prd-1000", "抹茶セット", null, 2, 10.0));
    confirmedOrder.setStatus(com.bobbuy.model.OrderStatus.CONFIRMED);
    store.upsertOrder(confirmedOrder);

    OrderHeader newOrder = new OrderHeader("BAL-NEW", customerId, trip.getId());
    newOrder.addLine(new OrderLine("prd-1000", "抹茶セット", null, 3, 20.0));
    newOrder.setStatus(com.bobbuy.model.OrderStatus.NEW);
    store.upsertOrder(newOrder);

    OrderHeader cancelledOrder = new OrderHeader("BAL-CANCELLED", customerId, trip.getId());
    cancelledOrder.addLine(new OrderLine("prd-1000", "抹茶セット", null, 4, 30.0));
    cancelledOrder.setStatus(com.bobbuy.model.OrderStatus.CANCELLED);
    store.upsertOrder(cancelledOrder);

    mockMvc.perform(asAgent(get("/api/procurement/{tripId}/ledger", trip.getId())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.meta.total").value(1))
        .andExpect(jsonPath("$.data[0].businessId").value("BAL-CONFIRMED"))
        .andExpect(jsonPath("$.data[0].amountDueThisTrip").value(20.0));

    mockMvc.perform(asAgent(get("/api/procurement/customers/{customerId}/balance", customerId)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.currentBalance").value(-20.0));
  }

  @Test
  void profitSharingEndpointsSupportReadAndUpdateWithAuditLog() throws Exception {
    Trip trip = store.createTrip(new Trip(null, 1000L, "NY", LocalDate.now(), TripStatus.PUBLISHED, null));
    OrderHeader order = new OrderHeader("PS-1", 1001L, trip.getId());
    order.addLine(new OrderLine("prd-1000", "Matcha", null, 2, 10.0));
    store.upsertOrder(order);

    mockMvc.perform(asAgent(get("/api/procurement/{tripId}/profit-sharing", trip.getId())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.purchaserRatioPercent").value(70.0))
        .andExpect(jsonPath("$.data.promoterRatioPercent").value(30.0))
        .andExpect(jsonPath("$.data.shares[0].partnerRole").value("PURCHASER"));

    mockMvc.perform(asAgent(patch("/api/procurement/{tripId}/profit-sharing", trip.getId())
            .contentType("application/json")
            .content("""
                {"purchaserRatioPercent":60,"promoterRatioPercent":40}
                """)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.purchaserRatioPercent").value(60.0))
        .andExpect(jsonPath("$.data.promoterRatioPercent").value(40.0));

    mockMvc.perform(asAgent(get("/api/procurement/{tripId}/audit-logs", trip.getId())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].actionType").value("PROFIT_SHARE_RATIO_UPDATE"));
  }

  @Test
  void logisticsEndpointsSupportTrackingAndSettlementReminderTrigger() throws Exception {
    Trip trip = store.createTrip(new Trip(null, 1000L, "NY", LocalDate.now(), TripStatus.PUBLISHED, null));

    MvcResult createResult = mockMvc.perform(asAgent(post("/api/procurement/{tripId}/logistics", trip.getId())
            .contentType("application/json")
            .content("""
                {"trackingNumber":"MOCK-DELIVERED","channel":"INTERNATIONAL","provider":"MOCK"}
                """)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.trackingNumber").value("MOCK-DELIVERED"))
        .andReturn();
    JsonNode createdPayload = objectMapper.readTree(createResult.getResponse().getContentAsString());
    long trackingId = createdPayload.path("data").path("id").asLong();

    mockMvc.perform(asAgent(post("/api/procurement/{tripId}/logistics/{trackingId}/refresh", trip.getId(), trackingId)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.status").value("DELIVERED"))
        .andExpect(jsonPath("$.data.settlementReminderTriggered").value(true));

    mockMvc.perform(asAgent(get("/api/procurement/{tripId}/logistics", trip.getId())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.meta.total").value(1))
        .andExpect(jsonPath("$.data[0].settlementReminderTriggered").value(true));
  }

  @Test
  void deliveryPreparationAndPickingChecklistSupportReadyForDeliveryFlow() throws Exception {
    Trip trip = store.createTrip(new Trip(null, 1000L, "NY", LocalDate.now(), TripStatus.IN_PROGRESS, null));
    OrderHeader order = new OrderHeader("PICK-100", 1001L, trip.getId());
    OrderLine line = new OrderLine("prd-1000", "抹茶セット", null, 2, 10.0);
    line.setPurchasedQuantity(1);
    order.addLine(line);
    order.setStatus(com.bobbuy.model.OrderStatus.CONFIRMED);
    store.upsertOrder(order);

    MvcResult uploadResult = mockMvc.perform(asAgent(post("/api/procurement/{tripId}/receipts", trip.getId())
            .contentType("application/json")
            .content("""
                {"receipts":[{"fileName":"receipt-pick.jpg","imageBase64":"data:image/jpeg;base64,aGVsbG8="}]}
                """)))
        .andExpect(status().isOk())
        .andReturn();
    long receiptId = objectMapper.readTree(uploadResult.getResponse().getContentAsString()).path("data").get(0).path("id").asLong();

    mockMvc.perform(asAgent(patch("/api/procurement/{tripId}/receipts/{receiptId}", trip.getId(), receiptId)
            .contentType("application/json")
            .content("""
                {"processingStatus":"RECONCILED","reconciliationResult":{"reviewStatus":"REVIEWED","receiptItems":[],"matchedOrderLines":[{"businessId":"PICK-100","skuId":"prd-1000","itemName":"抹茶セット","matchedQuantity":1}],"unmatchedReceiptItems":[],"missingOrderedItems":[{"businessId":"PICK-100","skuId":"prd-1000","itemName":"抹茶セット","missingQuantity":1,"disposition":"OUT_OF_STOCK"}],"selfUseItems":[]}}
                """)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.reconciliationResult.reviewStatus").value("REVIEWED"));

    mockMvc.perform(asAgent(get("/api/procurement/{tripId}/picking", trip.getId())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].businessId").value("PICK-100"))
        .andExpect(jsonPath("$.data[0].items[0].labels[0]").value("SHORT_SHIPPED"));

    mockMvc.perform(asAgent(patch("/api/procurement/{tripId}/picking/{businessId}", trip.getId(), "PICK-100")
            .contentType("application/json")
            .content("""
                {"skuId":"prd-1000","checked":true}
                """)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.readyForDelivery").value(true))
        .andExpect(jsonPath("$.data.deliveryStatus").value("READY_FOR_DELIVERY"));

    mockMvc.perform(asAgent(get("/api/procurement/{tripId}/delivery-preparations", trip.getId())))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data[0].businessId").value("PICK-100"))
        .andExpect(jsonPath("$.data[0].addressSummary").value(org.hamcrest.Matchers.containsString("Pudong")))
        .andExpect(jsonPath("$.data[0].deliveryStatus").value("READY_FOR_DELIVERY"));

    mockMvc.perform(asAgent(get("/api/procurement/{tripId}/delivery-preparations/export", trip.getId())))
        .andExpect(status().isOk())
        .andExpect(header().string("Content-Type", org.hamcrest.Matchers.containsString("text/csv")))
        .andExpect(content().string(org.hamcrest.Matchers.containsString("PICK-100")))
        .andExpect(content().string(org.hamcrest.Matchers.containsString("Pudong")));
  }

  private MockHttpServletRequestBuilder asAgent(MockHttpServletRequestBuilder request) {
    return request
        .header(RoleInjectionFilter.ROLE_HEADER, AGENT_ROLE)
        .header(RoleInjectionFilter.USER_HEADER, AGENT_USER);
  }

  private MockHttpServletRequestBuilder asCustomer(MockHttpServletRequestBuilder request, String user) {
    return request
        .header(RoleInjectionFilter.ROLE_HEADER, "CUSTOMER")
        .header(RoleInjectionFilter.USER_HEADER, user);
  }
}
