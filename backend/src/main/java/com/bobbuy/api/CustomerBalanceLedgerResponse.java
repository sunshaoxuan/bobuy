package com.bobbuy.api;

import java.time.LocalDateTime;
import java.util.List;

public class CustomerBalanceLedgerResponse {
  private final Long tripId;
  private final String businessId;
  private final Long customerId;
  private final String customerName;
  private final double totalReceivable;
  private final double paidDeposit;
  private final double outstandingBalance;
  private final double amountDueThisTrip;
  private final double amountReceivedThisTrip;
  private final double amountPendingThisTrip;
  private final double balanceBeforeCarryForward;
  private final double balanceAfterCarryForward;
  private final String settlementStatus;
  private final String deliveryStatus;
  private final String deliveryAddressSummary;
  private final String deliveryContactName;
  private final String deliveryContactPhone;
  private final Double deliveryLatitude;
  private final Double deliveryLongitude;
  private final boolean settlementFrozen;
  private final String settlementFreezeStage;
  private final String settlementFreezeReason;
  private final LocalDateTime receiptConfirmedAt;
  private final String receiptConfirmedBy;
  private final LocalDateTime billingConfirmedAt;
  private final String billingConfirmedBy;
  private final List<CustomerPaymentRecordResponse> paymentRecords;
  private final List<LedgerOrderLineResponse> orderLines;

  public CustomerBalanceLedgerResponse(Long tripId,
                                       String businessId,
                                       Long customerId,
                                       String customerName,
                                       double totalReceivable,
                                       double paidDeposit,
                                       double outstandingBalance,
                                       double amountDueThisTrip,
                                       double amountReceivedThisTrip,
                                       double amountPendingThisTrip,
                                       double balanceBeforeCarryForward,
                                       double balanceAfterCarryForward,
                                       String settlementStatus,
                                       String deliveryStatus,
                                       String deliveryAddressSummary,
                                       String deliveryContactName,
                                       String deliveryContactPhone,
                                       Double deliveryLatitude,
                                       Double deliveryLongitude,
                                       boolean settlementFrozen,
                                       String settlementFreezeStage,
                                       String settlementFreezeReason,
                                       LocalDateTime receiptConfirmedAt,
                                       String receiptConfirmedBy,
                                       LocalDateTime billingConfirmedAt,
                                       String billingConfirmedBy,
                                       List<CustomerPaymentRecordResponse> paymentRecords,
                                       List<LedgerOrderLineResponse> orderLines) {
    this.tripId = tripId;
    this.businessId = businessId;
    this.customerId = customerId;
    this.customerName = customerName;
    this.totalReceivable = totalReceivable;
    this.paidDeposit = paidDeposit;
    this.outstandingBalance = outstandingBalance;
    this.amountDueThisTrip = amountDueThisTrip;
    this.amountReceivedThisTrip = amountReceivedThisTrip;
    this.amountPendingThisTrip = amountPendingThisTrip;
    this.balanceBeforeCarryForward = balanceBeforeCarryForward;
    this.balanceAfterCarryForward = balanceAfterCarryForward;
    this.settlementStatus = settlementStatus;
    this.deliveryStatus = deliveryStatus;
    this.deliveryAddressSummary = deliveryAddressSummary;
    this.deliveryContactName = deliveryContactName;
    this.deliveryContactPhone = deliveryContactPhone;
    this.deliveryLatitude = deliveryLatitude;
    this.deliveryLongitude = deliveryLongitude;
    this.settlementFrozen = settlementFrozen;
    this.settlementFreezeStage = settlementFreezeStage;
    this.settlementFreezeReason = settlementFreezeReason;
    this.receiptConfirmedAt = receiptConfirmedAt;
    this.receiptConfirmedBy = receiptConfirmedBy;
    this.billingConfirmedAt = billingConfirmedAt;
    this.billingConfirmedBy = billingConfirmedBy;
    this.paymentRecords = paymentRecords;
    this.orderLines = orderLines;
  }

  public Long getTripId() {
    return tripId;
  }

  public String getBusinessId() {
    return businessId;
  }

  public Long getCustomerId() {
    return customerId;
  }

  public String getCustomerName() {
    return customerName;
  }

  public double getTotalReceivable() {
    return totalReceivable;
  }

  public double getPaidDeposit() {
    return paidDeposit;
  }

  public double getOutstandingBalance() {
    return outstandingBalance;
  }

  public double getAmountDueThisTrip() {
    return amountDueThisTrip;
  }

  public double getAmountReceivedThisTrip() {
    return amountReceivedThisTrip;
  }

  public double getAmountPendingThisTrip() {
    return amountPendingThisTrip;
  }

  public double getBalanceBeforeCarryForward() {
    return balanceBeforeCarryForward;
  }

  public double getBalanceAfterCarryForward() {
    return balanceAfterCarryForward;
  }

  public String getSettlementStatus() {
    return settlementStatus;
  }

  public String getDeliveryStatus() {
    return deliveryStatus;
  }

  public String getDeliveryAddressSummary() {
    return deliveryAddressSummary;
  }

  public String getDeliveryContactName() {
    return deliveryContactName;
  }

  public String getDeliveryContactPhone() {
    return deliveryContactPhone;
  }

  public Double getDeliveryLatitude() {
    return deliveryLatitude;
  }

  public Double getDeliveryLongitude() {
    return deliveryLongitude;
  }

  public boolean isSettlementFrozen() {
    return settlementFrozen;
  }

  public String getSettlementFreezeStage() {
    return settlementFreezeStage;
  }

  public String getSettlementFreezeReason() {
    return settlementFreezeReason;
  }

  public LocalDateTime getReceiptConfirmedAt() {
    return receiptConfirmedAt;
  }

  public String getReceiptConfirmedBy() {
    return receiptConfirmedBy;
  }

  public LocalDateTime getBillingConfirmedAt() {
    return billingConfirmedAt;
  }

  public String getBillingConfirmedBy() {
    return billingConfirmedBy;
  }

  public List<CustomerPaymentRecordResponse> getPaymentRecords() {
    return paymentRecords;
  }

  public List<LedgerOrderLineResponse> getOrderLines() {
    return orderLines;
  }

  public static class LedgerOrderLineResponse {
    private OrderIdentitySnapshot snapshot;
    public OrderIdentitySnapshot getSnapshot(){return snapshot;}
    public LedgerOrderLineResponse withSnapshot(OrderIdentitySnapshot value){snapshot=value;return this;}
    private final String skuId;
    private final String itemName;
    private final int orderedQuantity;
    private final double unitPrice;
    private final int purchasedQuantity;
    private final String differenceNote;

    public LedgerOrderLineResponse(String skuId,
                                   String itemName,
                                   int orderedQuantity,
                                   double unitPrice,
                                   int purchasedQuantity,
                                   String differenceNote) {
      this.skuId = skuId;
      this.itemName = itemName;
      this.orderedQuantity = orderedQuantity;
      this.unitPrice = unitPrice;
      this.purchasedQuantity = purchasedQuantity;
      this.differenceNote = differenceNote;
    }

    public String getSkuId() {
      return skuId;
    }

    public String getItemName() {
      return itemName;
    }

    public int getOrderedQuantity() {
      return orderedQuantity;
    }

    public double getUnitPrice() {
      return unitPrice;
    }

    public int getPurchasedQuantity() {
      return purchasedQuantity;
    }

    public String getDifferenceNote() {
      return differenceNote;
    }
  }
}
