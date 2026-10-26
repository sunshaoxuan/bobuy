package com.bobbuy.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

/** Reviewed, retained selling-price adjustment; never an external reference offer. */
@Entity @Table(name="bb_product_price_adjustment")
public class ProductPriceAdjustment {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
 @Version public long version;
 @Column(nullable=false) public Long merchantId;
 @Column(nullable=false) public String productId;
 @Column(nullable=false,length=40) public String channel="STOREFRONT";
 @Column(nullable=false,length=3) public String currency;
 @Column(nullable=false,precision=18,scale=4) public BigDecimal amount;
 @Column(length=80) public String unit;
 @Column(nullable=false) public Instant startsAt;
 @Column(nullable=false) public Instant endsAt;
 @Enumerated(EnumType.STRING) @Column(nullable=false,length=20) public Status status=Status.DRAFT;
 @Column(nullable=false,length=1000) public String sourceNote="";
 @Column(nullable=false) public Long createdBy;
 @Column(nullable=false) public Instant createdAt;
 @Column(nullable=false) public Long updatedBy;
 @Column(nullable=false) public Instant updatedAt;
 public Long approvedBy; public Instant approvedAt;
 public Long cancelledBy; public Instant cancelledAt;
 public enum Status { DRAFT, APPROVED, CANCELLED }
}
