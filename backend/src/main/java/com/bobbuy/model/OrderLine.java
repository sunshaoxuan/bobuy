package com.bobbuy.model;

/**
 * 订单行模型 - 具体的购买条目
 * 对齐设计文档: ARCH-11
 */
public class OrderLine {
    private Long id; // 物理主键
    private Long headerId; // 头关联 ID
    private String skuId; // 商品唯一标识
    private java.util.Map<String,String> names=new java.util.HashMap<>();
    public java.util.Map<String,String> getNames(){return names;}
    public void setNames(java.util.Map<String,String> value){names=value==null?new java.util.HashMap<>():new java.util.HashMap<>(value);}
    private String itemName; // 商品名称 (冗余用于展现)
    private String spec; // 规格区分 (用于隔离权重品)
    private int quantity; // 数量
    private int purchasedQuantity; // 已采购数量
    private String currency="JPY";
    public String getCurrency(){return currency;}
    public void setCurrency(String value){currency=value;}
    private long priceRevision;
    public long getPriceRevision(){return priceRevision;}
    public void setPriceRevision(long value){priceRevision=value;}
    private double unitPrice; // 单价
    private boolean pickingConfirmed; // 拣货确认

    public OrderLine() {
    }

    public OrderLine(String skuId, String itemName, String spec, int quantity, double unitPrice) {
        this.skuId = skuId;
        this.itemName = itemName;
        this.spec = spec;
        this.quantity = quantity;
        this.purchasedQuantity = 0;
        this.unitPrice = unitPrice;
        this.pickingConfirmed = false;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getHeaderId() {
        return headerId;
    }

    public void setHeaderId(Long headerId) {
        this.headerId = headerId;
    }

    public String getSkuId() {
        return skuId;
    }

    public void setSkuId(String skuId) {
        this.skuId = skuId;
    }

    public String getItemName() {
        return itemName;
    }

    public void setItemName(String itemName) {
        this.itemName = itemName;
    }

    public String getSpec() {
        return spec;
    }

    public void setSpec(String spec) {
        this.spec = spec;
    }

    public int getQuantity() {
        return quantity;
    }

    public void setQuantity(int quantity) {
        this.quantity = quantity;
    }

    public double getUnitPrice() {
        return unitPrice;
    }

    public void setUnitPrice(double unitPrice) {
        this.unitPrice = unitPrice;
    }

    public int getPurchasedQuantity() {
        return purchasedQuantity;
    }

    public void setPurchasedQuantity(int purchasedQuantity) {
        this.purchasedQuantity = Math.max(purchasedQuantity, 0);
    }

    public boolean isPickingConfirmed() {
        return pickingConfirmed;
    }

    public void setPickingConfirmed(boolean pickingConfirmed) {
        this.pickingConfirmed = pickingConfirmed;
    }

    /**
     * 判断两行是否符合业务合并准则
     * 准则: SKU 相同 且 Spec 相同
     */
    public boolean canMergeWith(OrderLine other) {
        if (other == null)
            return false;
        boolean skuMatch = this.skuId != null && this.skuId.equals(other.skuId);
        boolean specMatch = (this.spec == null && other.spec == null) ||
                (this.spec != null && this.spec.equals(other.spec));
        return skuMatch && specMatch && java.util.Objects.equals(currency,other.currency) && Double.compare(unitPrice,other.unitPrice)==0;
    }
}
