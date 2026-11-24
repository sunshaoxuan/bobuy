package com.bobbuy.model;

import java.util.List;
import java.util.Map;

public class ProductPatch {
    private Map<String, String> name;
    private Map<String, String> description;
    private String brand;
    private Double basePrice;
    private Double weight;
    private Double volume;
    private List<MediaGalleryItem> mediaGallery;
    private StorageCondition storageCondition;
    private OrderMethod orderMethod;
    private String categoryId;
    private Map<String, String> merchantSkus;
    private Map<String, String> attributes;
    private String itemNumber;
    private List<PriceTier> priceTiers;
    private Boolean isRecommended;
    private Boolean isTemporary;
    private ProductVisibility visibilityStatus;
    private Boolean cartEnabled;
    private List<String> categoryNodeIds;
    private String primaryCategoryNodeId;
    private Long categoryRevision;

    public List<String> getCategoryNodeIds() { return categoryNodeIds; }
    public void setCategoryNodeIds(List<String> value) { categoryNodeIds = value; }
    public String getPrimaryCategoryNodeId() { return primaryCategoryNodeId; }
    public void setPrimaryCategoryNodeId(String value) { primaryCategoryNodeId = value; }
    public Long getCategoryRevision() { return categoryRevision; }
    public void setCategoryRevision(Long value) { categoryRevision = value; }

    public Boolean getCartEnabled() {
        return cartEnabled;
    }

    public void setCartEnabled(Boolean cartEnabled) {
        this.cartEnabled = cartEnabled;
    }

    public Map<String, String> getName() {
        return name;
    }

    public void setName(Map<String, String> name) {
        this.name = name;
    }

    public Map<String, String> getDescription() {
        return description;
    }

    public void setDescription(Map<String, String> description) {
        this.description = description;
    }

    public String getBrand() {
        return brand;
    }

    public void setBrand(String brand) {
        this.brand = brand;
    }

    public Double getBasePrice() {
        return basePrice;
    }

    public void setBasePrice(Double basePrice) {
        this.basePrice = basePrice;
    }

    public Double getWeight() {
        return weight;
    }

    public void setWeight(Double weight) {
        this.weight = weight;
    }

    public Double getVolume() {
        return volume;
    }

    public void setVolume(Double volume) {
        this.volume = volume;
    }

    public List<MediaGalleryItem> getMediaGallery() {
        return mediaGallery;
    }

    public void setMediaGallery(List<MediaGalleryItem> mediaGallery) {
        this.mediaGallery = mediaGallery;
    }

    public StorageCondition getStorageCondition() {
        return storageCondition;
    }

    public void setStorageCondition(StorageCondition storageCondition) {
        this.storageCondition = storageCondition;
    }

    public OrderMethod getOrderMethod() {
        return orderMethod;
    }

    public void setOrderMethod(OrderMethod orderMethod) {
        this.orderMethod = orderMethod;
    }

    public String getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(String categoryId) {
        this.categoryId = categoryId;
    }

    public Map<String, String> getMerchantSkus() {
        return merchantSkus;
    }

    public void setMerchantSkus(Map<String, String> merchantSkus) {
        this.merchantSkus = merchantSkus;
    }

    public Map<String, String> getAttributes() {
        return attributes;
    }

    public void setAttributes(Map<String, String> attributes) {
        this.attributes = attributes;
    }

    public String getItemNumber() {
        return itemNumber;
    }

    public void setItemNumber(String itemNumber) {
        this.itemNumber = itemNumber;
    }

    public List<PriceTier> getPriceTiers() {
        return priceTiers;
    }

    public void setPriceTiers(List<PriceTier> priceTiers) {
        this.priceTiers = priceTiers;
    }

    public Boolean getIsRecommended() {
        return isRecommended;
    }

    public void setIsRecommended(Boolean isRecommended) {
        this.isRecommended = isRecommended;
    }

    public Boolean getIsTemporary() {
        return isTemporary;
    }

    public void setIsTemporary(Boolean isTemporary) {
        this.isTemporary = isTemporary;
    }

    public ProductVisibility getVisibilityStatus() {
        return visibilityStatus;
    }

    public void setVisibilityStatus(ProductVisibility visibilityStatus) {
        this.visibilityStatus = visibilityStatus;
    }
}
