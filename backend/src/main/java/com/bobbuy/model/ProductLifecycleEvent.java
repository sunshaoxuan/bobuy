package com.bobbuy.model;
@jakarta.persistence.Entity @jakarta.persistence.Table(name="bb_product_lifecycle_event")
public class ProductLifecycleEvent {
 @jakarta.persistence.Id public String id;
 public String productId;
 public String action;
 public Long actorId;
 public java.time.Instant occurredAt;
}
