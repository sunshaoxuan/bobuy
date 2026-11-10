package com.bobbuy.model;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.*;

/** Append-only metadata checkpoint. Never contains prices, stock or issue membership. */
@Entity @Table(name="bb_product_catalog_recovery")
public class ProductCatalogRecovery {
 @Id @Column(length=36) public String id;
 @Column(nullable=false) public Long merchantId;
 @Column(nullable=false) public String productId;
 @Column(nullable=false) public long versionAfter;
 @Column(nullable=false) public Instant createdAt;
 @Column(length=36) public String restoredFromId;
 @JdbcTypeCode(SqlTypes.JSON) @Column(nullable=false,columnDefinition="jsonb") public State original;
 public record State(Map<String,String> name,Map<String,String> description,String itemNumber,String brand,String categoryId,ProductCatalogData catalogData,List<MediaGalleryItem> gallery,List<Long> sourceItemIds){}
 public static State capture(Product p,List<Long> sourceItemIds){
  try{return new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules().readValue(new com.fasterxml.jackson.databind.ObjectMapper().findAndRegisterModules().writeValueAsBytes(new State(p.getName(),p.getDescription(),p.getItemNumber(),p.getBrand(),p.getCategoryId(),p.getCatalogData(),p.getMediaGallery(),sourceItemIds)),State.class);}catch(Exception e){throw new IllegalStateException("Cannot retain catalog checkpoint",e);}
 }
 public void apply(Product p){
  p.setName(new HashMap<>(original.name()));p.setDescription(new HashMap<>(original.description()));p.setItemNumber(original.itemNumber());p.setBrand(original.brand());p.setCategoryId(original.categoryId());p.setCatalogData(original.catalogData());p.setMediaGallery(new ArrayList<>(original.gallery()));
 }
}
