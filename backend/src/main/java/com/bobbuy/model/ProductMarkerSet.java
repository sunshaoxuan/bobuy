package com.bobbuy.model;
import jakarta.persistence.*;
import java.util.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
@Entity @Table(name="bb_product_marker_set")
public class ProductMarkerSet {
 @Id @Column(name="product_id") public String productId;
 @Column(name="merchant_id",nullable=false) public Long merchantId;
 @JdbcTypeCode(SqlTypes.JSON) @Column(name="marker_ids",nullable=false,columnDefinition="jsonb") public List<String> markerIds=new ArrayList<>();
 @Version public Long version;
}
