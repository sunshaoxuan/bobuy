package com.bobbuy.api;

import java.util.List;

public class PickingChecklistItemResponse {
  private OrderIdentitySnapshot snapshot;
  public OrderIdentitySnapshot getSnapshot(){return snapshot;}
  public PickingChecklistItemResponse withSnapshot(OrderIdentitySnapshot value){snapshot=value;return this;}
  private final String skuId;
  private final String itemName;
  private final int orderedQuantity;
  private final int pickedQuantity;
  private final boolean checked;
  private final List<String> labels;

  public PickingChecklistItemResponse(String skuId,
                                      String itemName,
                                      int orderedQuantity,
                                      int pickedQuantity,
                                      boolean checked,
                                      List<String> labels) {
    this.skuId = skuId;
    this.itemName = itemName;
    this.orderedQuantity = orderedQuantity;
    this.pickedQuantity = pickedQuantity;
    this.checked = checked;
    this.labels = labels;
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

  public int getPickedQuantity() {
    return pickedQuantity;
  }

  public boolean isChecked() {
    return checked;
  }

  public List<String> getLabels() {
    return labels;
  }
}
