package com.bobbuy.model;
import jakarta.persistence.*;
@Entity @Table(name="bb_product_click")
public class ProductClick {
 @Id @Column(name="product_id",length=255) public String productId;
 @Column(nullable=false) public long clicks;
}
