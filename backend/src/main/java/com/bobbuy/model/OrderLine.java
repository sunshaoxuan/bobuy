package com.bobbuy.model;

/**
 * 订单行模型 - 具体的购买条目
 * 对齐设计文档: ARCH-11
 */
public class OrderLine {
    // Additive purchase-time metadata. Never repurpose legacy spec (often a sale unit).
    private String brand;
    private String itemNumber;
    private String model;
    private String packaging;
    private String saleUnit;
    private java.util.Map<String,String> specifications = new java.util.HashMap<>();
    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_EMPTY)
    public String getBrand(){return brand;}
    public void setBrand(String value){brand=value;}
    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_EMPTY)
    public String getItemNumber(){return itemNumber;}
    public void setItemNumber(String value){itemNumber=value;}
    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_EMPTY)
    public String getModel(){return model;}
    public void setModel(String value){model=value;}
    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_EMPTY)
    public String getPackaging(){return packaging;}
    public void setPackaging(String value){packaging=value;}
    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_EMPTY)
    public String getSaleUnit(){return saleUnit;}
    public void setSaleUnit(String value){saleUnit=value;}
    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_EMPTY)
    public java.util.Map<String,String> getSpecifications(){return specifications;}
    public void setSpecifications(java.util.Map<String,String> value){specifications=value==null?new java.util.HashMap<>():new java.util.HashMap<>(value);}
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
    private java.math.BigDecimal quotedAmount;
    private java.math.BigDecimal regularAmount;
    private Long priceAdjustmentId;
    private String priceChannel;
    private java.time.Instant pricedAt;
    public java.math.BigDecimal getQuotedAmount(){return quotedAmount;}
    public void setQuotedAmount(java.math.BigDecimal value){quotedAmount=value;}
    public java.math.BigDecimal getRegularAmount(){return regularAmount;}
    public void setRegularAmount(java.math.BigDecimal value){regularAmount=value;}
    public Long getPriceAdjustmentId(){return priceAdjustmentId;}
    public void setPriceAdjustmentId(Long value){priceAdjustmentId=value;}
    public String getPriceChannel(){return priceChannel;}
    public void setPriceChannel(String value){priceChannel=value;}
    public java.time.Instant getPricedAt(){return pricedAt;}
    public void setPricedAt(java.time.Instant value){pricedAt=value;}
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
        return skuMatch && specMatch && java.util.Objects.equals(currency,other.currency) && Double.compare(unitPrice,other.unitPrice)==0
            && java.util.Objects.equals(brand,other.brand) && java.util.Objects.equals(itemNumber,other.itemNumber)
            && java.util.Objects.equals(model,other.model) && java.util.Objects.equals(packaging,other.packaging)
            && java.util.Objects.equals(saleUnit,other.saleUnit) && java.util.Objects.equals(specifications,other.specifications);
    }

    /** Hibernate snapshots JSON by value. Identity equality makes every loaded list dirty,
     * causing read-only queries to update the order and advance its optimistic revision. */
    @Override
    public boolean equals(Object value) {
        if (this == value) return true;
        if (!(value instanceof OrderLine other)) return false;
        return quantity == other.quantity && purchasedQuantity == other.purchasedQuantity
                && priceRevision == other.priceRevision && Double.compare(unitPrice, other.unitPrice) == 0
                && pickingConfirmed == other.pickingConfirmed
                && java.util.Objects.equals(id, other.id) && java.util.Objects.equals(headerId, other.headerId)
                && java.util.Objects.equals(skuId, other.skuId) && java.util.Objects.equals(names, other.names)
                && java.util.Objects.equals(itemName, other.itemName) && java.util.Objects.equals(spec, other.spec)
                && java.util.Objects.equals(currency, other.currency)
                && java.util.Objects.equals(quotedAmount, other.quotedAmount) && java.util.Objects.equals(regularAmount, other.regularAmount)
                && java.util.Objects.equals(priceAdjustmentId, other.priceAdjustmentId) && java.util.Objects.equals(priceChannel, other.priceChannel)
                && java.util.Objects.equals(pricedAt, other.pricedAt) && java.util.Objects.equals(brand, other.brand)
                && java.util.Objects.equals(itemNumber, other.itemNumber) && java.util.Objects.equals(model, other.model)
                && java.util.Objects.equals(packaging, other.packaging) && java.util.Objects.equals(saleUnit, other.saleUnit)
                && java.util.Objects.equals(specifications, other.specifications);
    }

    @Override
    public int hashCode() {
        return java.util.Objects.hash(id, headerId, skuId, names, itemName, spec, quantity, purchasedQuantity,
                currency, priceRevision, quotedAmount, regularAmount, priceAdjustmentId, priceChannel, pricedAt,
                unitPrice, pickingConfirmed, brand, itemNumber, model, packaging, saleUnit, specifications);
    }
}
