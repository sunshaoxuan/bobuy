package com.bobbuy.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "bb_recommendation_item", uniqueConstraints = @UniqueConstraint(columnNames = {"post_id", "product_id", "image_hash"}))
public class RecommendationItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) public Long id;
    @Column(nullable = false) public Long postId;
    public String productId;
    @Transient public boolean catalogDriven;
    @Transient public String brand;
    @Transient public String model;
    @Transient public String packaging;
    public record SourceFacts(String name,String itemNumber,String specification,String description,java.util.Map<String,Text> translations,String translationSource) {}
    @Transient public SourceFacts sourceFacts;
    public record Picture(String id,String url,String hash,String sourceUrl,String assetKey,String label,java.time.Instant verifiedAt) {}
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    @Column(nullable=false,columnDefinition="jsonb") public java.util.List<Picture> gallery=new java.util.ArrayList<>();

    @Column(nullable = false, length = 200) public String name;
    public String itemNumber;
    @Column(length=1000) public String specification;
    @Column(length=8000) public String description;
    public record Text(String name,String specification,String description,String offerNotes) {}
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    @Column(nullable=false,columnDefinition="jsonb") public java.util.Map<String,Text> translations=new java.util.HashMap<>();
    public String translatedSource;
    @Transient public String getTranslationSource(){
        try {return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(
            String.join("\n",java.util.Objects.toString(name,""),java.util.Objects.toString(priceUnit,""),java.util.Objects.toString(offerNotes,""),java.util.Objects.toString(specification,""),java.util.Objects.toString(description,"")).getBytes(java.nio.charset.StandardCharsets.UTF_8)));}
        catch(java.security.NoSuchAlgorithmException e){throw new IllegalStateException(e);}
    }
    @Transient public String getTranslationStatus(){return translations==null||translations.isEmpty()?"MISSING":getTranslationSource().equals(translatedSource)?"REVIEWED":"STALE";}

    @Column(precision = 14, scale = 2) public BigDecimal referencePrice;
    @Column(precision = 14, scale = 2) public BigDecimal originalPrice;
    @Column(precision = 14, scale = 2) public BigDecimal discountAmount;
    @Column(length = 100) public String priceUnit;
    public java.time.LocalDate offerStart;
    public java.time.LocalDate offerEnd;
    public java.time.LocalDate couponStart;
    public java.time.LocalDate couponEnd;
    @Column(length = 2000) public String offerNotes;
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    @Column(nullable=false, columnDefinition="jsonb") public java.util.List<String> categoryIds = new java.util.ArrayList<>();
    public String supplierId;
    @Column(nullable=false) public boolean showSupplier;
    public record Label(String id, java.util.Map<String,String> name) {}
    @Transient public java.util.List<Label> categories = java.util.List.of();
    @Transient public java.util.Map<String,String> supplierName;
    public String getCurrency() { return "JPY"; }
    @Column(nullable = false, length = 64) public String imageHash;
    @Column(nullable = false, length = 2048) public String imageUrl;
    @Column(nullable = false) public LocalDateTime createdAt = LocalDateTime.now();
}
