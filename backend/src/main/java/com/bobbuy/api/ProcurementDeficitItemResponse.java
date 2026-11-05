package com.bobbuy.api;

public class ProcurementDeficitItemResponse {
  private java.util.List<OrderIdentitySnapshot> snapshots=java.util.List.of();
  public java.util.List<OrderIdentitySnapshot> getSnapshots(){return snapshots;}
  public ProcurementDeficitItemResponse withSnapshots(java.util.List<OrderIdentitySnapshot> value){snapshots=java.util.List.copyOf(value);return this;}
  private final String skuId;
  private final String itemName;
  private final int deficitQuantity;
  private final double completionPercent;
  private final String priority;
  private final boolean isTemporary;
  private final String visibilityStatus;

  public ProcurementDeficitItemResponse(String skuId, String itemName, int deficitQuantity, double completionPercent, String priority, boolean isTemporary, String visibilityStatus) {
    this.skuId = skuId;
    this.itemName = itemName;
    this.deficitQuantity = deficitQuantity;
    this.completionPercent = completionPercent;
    this.priority = priority;
    this.isTemporary = isTemporary;
    this.visibilityStatus = visibilityStatus;
  }

  public String getSkuId() {
    return skuId;
  }

  public String getItemName() {
    return itemName;
  }

  public int getDeficitQuantity() {
    return deficitQuantity;
  }

  public double getCompletionPercent() {
    return completionPercent;
  }

  public String getPriority() {
    return priority;
  }

  public boolean isTemporary() {
    return isTemporary;
  }

  public String getVisibilityStatus() {
    return visibilityStatus;
  }
}
