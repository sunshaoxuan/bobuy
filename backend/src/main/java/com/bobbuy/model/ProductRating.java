package com.bobbuy.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;

/** Merchant-maintained product rating. Absence is unrated; this is not a review count. */
@Entity @Table(name="bb_product_rating")
public class ProductRating {
 @Id public String productId;
 @Column(nullable=false) public Long merchantId;
 @Column(precision=2,scale=1) public BigDecimal stars;
 @Column(nullable=false) public boolean publicVisible;
 @Column(nullable=false) public long version;
 @Column(nullable=false) public Instant reviewedAt;
}
