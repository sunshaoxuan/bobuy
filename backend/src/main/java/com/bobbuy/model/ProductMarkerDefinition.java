package com.bobbuy.model;
import jakarta.persistence.*;
import java.util.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
@Entity @Table(name="bb_product_marker_definition",uniqueConstraints=@UniqueConstraint(columnNames={"merchant_id","code"}))
public class ProductMarkerDefinition {
 @Id public String id;
 @Column(name="merchant_id",nullable=false) public Long merchantId;
 @Column(nullable=false,length=40,updatable=false) public String code;
 @Column(nullable=false,length=8) public String badge;
 @JdbcTypeCode(SqlTypes.JSON) @Column(nullable=false,columnDefinition="jsonb") public Map<String,String> name=new HashMap<>();
 @JdbcTypeCode(SqlTypes.JSON) @Column(nullable=false,columnDefinition="jsonb") public Map<String,String> description=new HashMap<>();
 @Column(nullable=false,length=16) public String color;
 @Column(name="sort_order",nullable=false) public int sortOrder;
 @Column(nullable=false) public boolean enabled;
 @Version public Long version;
}
