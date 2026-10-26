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
    @Column(nullable = false, length = 200) public String name;
    public String itemNumber;
    @Column(precision = 14, scale = 2) public BigDecimal referencePrice;
    @Column(precision = 14, scale = 2) public BigDecimal originalPrice;
    @Column(precision = 14, scale = 2) public BigDecimal discountAmount;
    @Column(length = 100) public String priceUnit;
    public java.time.LocalDate offerStart;
    public java.time.LocalDate offerEnd;
    public java.time.LocalDate couponStart;
    public java.time.LocalDate couponEnd;
    @Column(length = 2000) public String offerNotes;
    public String getCurrency() { return "JPY"; }
    @Column(nullable = false, length = 64) public String imageHash;
    @Column(nullable = false, length = 2048) public String imageUrl;
    @Column(nullable = false) public LocalDateTime createdAt = LocalDateTime.now();
}
