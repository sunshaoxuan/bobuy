package com.bobbuy.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

/** ERP price-change document. Channel explicitly separates selling and supplier reference prices. */
@Entity @Table(name="bb_product_price_adjustment")
public class ProductPriceAdjustment {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
 @Version public long version;
 @Column(nullable=false) public Long merchantId;
 @Column(nullable=false,length=40) public String channel="STOREFRONT";
 @Column(nullable=false,length=3) public String currency;
 @Column(length=80,unique=true) public String documentNumber;
 @Column(length=255,unique=true) public String sourceKey;
 @Enumerated(EnumType.STRING) @Column(nullable=false,length=20) public Type type=Type.TEMPORARY;
 public Instant startsAt;
 public Instant endsAt;
 @OneToMany(mappedBy="document",cascade=CascadeType.ALL,orphanRemoval=true,fetch=FetchType.EAGER)
 @OrderBy("id") public java.util.List<ProductPriceAdjustmentLine> lines=new java.util.ArrayList<>();
 @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
 @Column(nullable=false,columnDefinition="jsonb") public java.util.Map<String,Object> evidence=new java.util.HashMap<>();
 @Enumerated(EnumType.STRING) @Column(nullable=false,length=20) public Status status=Status.DRAFT;
 @Column(nullable=false,length=1000) public String sourceNote="";
 @Column(nullable=false) public Long createdBy;
 @Column(nullable=false) public Instant createdAt;
 @Column(nullable=false) public Long updatedBy;
 @Column(nullable=false) public Instant updatedAt;
 public Long approvedBy; public Instant approvedAt;
 public Long cancelledBy; public Instant cancelledAt;
 @Column(length=1000) public String cancellationReason;
 public enum Status { DRAFT, APPROVED, CANCELLED }
 public enum Type { PROMOTION, TEMPORARY, PERMANENT }
 public ProductPriceAdjustmentLine line(String productId){return lines.stream().filter(l->java.util.Objects.equals(l.productId,productId)).findFirst().orElse(null);}
}
