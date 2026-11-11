package com.bobbuy.model;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
@Entity @Table(name="bb_product_review",uniqueConstraints=@UniqueConstraint(columnNames={"product_id","user_id"}))
public class ProductReview {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
 @Column(name="product_id",nullable=false) public String productId;
 @Column(name="user_id",nullable=false) public Long userId;
 @Column(nullable=false,precision=2,scale=1) public BigDecimal stars;
 @Column(nullable=false,length=2000) public String comment="";
 @Column(nullable=false) public long version;
 @Column(nullable=false) public Instant createdAt;
 @Column(nullable=false) public Instant updatedAt;
}
