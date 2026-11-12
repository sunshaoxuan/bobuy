package com.bobbuy.model;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity @Table(name="bb_product_price_adjustment_line",uniqueConstraints=@UniqueConstraint(columnNames={"document_id","product_id"}))
public class ProductPriceAdjustmentLine {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
 @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="document_id",nullable=false)
 @com.fasterxml.jackson.annotation.JsonIgnore public ProductPriceAdjustment document;
 @Column(length=255) public String productId;
 @Column(precision=18,scale=4) public BigDecimal amount;
 @Column(precision=18,scale=4) public BigDecimal beforeAmount;
 @Column(length=100) public String unit;
 public Long referenceItemId;
}
