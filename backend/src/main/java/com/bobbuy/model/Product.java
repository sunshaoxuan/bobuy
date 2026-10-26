package com.bobbuy.model;

import com.bobbuy.model.converter.MediaGalleryJsonConverter;
import com.bobbuy.model.converter.PriceTierListJsonConverter;
import com.bobbuy.model.converter.StringMapJsonConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.time.LocalDateTime;

@Entity
@Table(name = "bb_product")
public class Product {
    @Id
    private String id;

    private Long merchantId;
    public Long getMerchantId() { return merchantId; }
    public void setMerchantId(Long value) { merchantId = value; }

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, String> name = new HashMap<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, String> description = new HashMap<>();

    private String brand;
    private double basePrice;
    @jakarta.persistence.Version
    @com.fasterxml.jackson.annotation.JsonProperty(access=com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY)
    private Long recordVersion;
    public Long getRecordVersion(){return recordVersion;}
    public void setRecordVersion(Long value){recordVersion=value;}

    @com.fasterxml.jackson.annotation.JsonProperty(access=com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY)
    private String currency="JPY";
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition="jsonb")
    @com.fasterxml.jackson.annotation.JsonProperty(access=com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY)
    private ProductSale sale;
    public String getCurrency(){return currency;}
    public void setCurrency(String value){currency=value;}
    public ProductSale getSale(){return sale;}
    public void setSale(ProductSale value){sale=value;}

    private Double weight;
    private Double volume;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<MediaGalleryItem> mediaGallery = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    private StorageCondition storageCondition;
    @Enumerated(EnumType.STRING)
    private OrderMethod orderMethod;
    private String categoryId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "merchant_skus", columnDefinition = "jsonb")
    private Map<String, String> merchantSkus;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, String> attributes = new HashMap<>();

    private String itemNumber; // For AI matching and shelf identification

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "price_tiers", columnDefinition = "jsonb")
    private List<PriceTier> priceTiers = new ArrayList<>();

    private boolean isRecommended;
    private boolean isTemporary;

    @Enumerated(EnumType.STRING)
    private ProductVisibility visibilityStatus = ProductVisibility.PUBLIC;

    private LocalDateTime updatedAt;

    public Product() {
        this.merchantSkus = new HashMap<>();
        this.attributes = new HashMap<>();
    }

    public Product(String id,
                   Map<String, String> name,
                   Map<String, String> description,
                   String brand,
                   double basePrice,
                   Double weight,
                   Double volume,
                   List<MediaGalleryItem> mediaGallery,
                   StorageCondition storageCondition,
                   OrderMethod orderMethod,
                   String categoryId,
                   Map<String, String> merchantSkus) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.brand = brand;
        this.basePrice = basePrice;
        this.weight = weight;
        this.volume = volume;
        this.mediaGallery = mediaGallery;
        this.storageCondition = storageCondition;
        this.orderMethod = orderMethod;
        this.categoryId = categoryId;
        this.merchantSkus = merchantSkus == null ? new HashMap<>() : merchantSkus;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
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

    public double getBasePrice() {
        return basePrice;
    }

    public void setBasePrice(double basePrice) {
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
        this.attributes = attributes == null ? new HashMap<>() : new HashMap<>(attributes);
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

    public boolean isRecommended() {
        return isRecommended;
    }

    public void setRecommended(boolean recommended) {
        isRecommended = recommended;
    }

    public boolean isTemporary() {
        return isTemporary;
    }

    public void setTemporary(boolean temporary) {
        isTemporary = temporary;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public ProductVisibility getVisibilityStatus() {
        return visibilityStatus;
    }

    public void setVisibilityStatus(ProductVisibility visibilityStatus) {
        this.visibilityStatus = visibilityStatus;
    }

    @PrePersist
    @PreUpdate
    public void touchUpdatedAt() {
        this.updatedAt = LocalDateTime.now();
    }
}
