package com.bobbuy.model;

import java.time.LocalDateTime;

public class AuditLog {
  private Long id;
  private String entityType;
  private Long entityId;
  private String productId;
  private String action;
  private String beforeValue;
  private String afterValue;
  private Long userId;
  private LocalDateTime createdAt;

  public AuditLog() {
  }

  public AuditLog(Long id, String entityType, Long entityId, String action, String beforeValue, String afterValue,
                  Long userId, LocalDateTime createdAt) {
    this.id = id;
    this.entityType = entityType;
    this.entityId = entityId;
    this.action = action;
    this.beforeValue = beforeValue;
    this.afterValue = afterValue;
    this.userId = userId;
    this.createdAt = createdAt;
  }

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public String getEntityType() {
    return entityType;
  }

  public void setEntityType(String entityType) {
    this.entityType = entityType;
  }

  public Long getEntityId() {
    return entityId;
  }

  @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
  public String getProductId() {
    return productId;
  }

  public void setProductId(String productId) {
    this.productId = productId;
  }

  public void setEntityId(Long entityId) {
    this.entityId = entityId;
  }

  public String getAction() {
    return action;
  }

  public void setAction(String action) {
    this.action = action;
  }

  public String getBeforeValue() {
    return beforeValue;
  }

  public void setBeforeValue(String beforeValue) {
    this.beforeValue = beforeValue;
  }

  public String getAfterValue() {
    return afterValue;
  }

  public void setAfterValue(String afterValue) {
    this.afterValue = afterValue;
  }

  public Long getUserId() {
    return userId;
  }

  public void setUserId(Long userId) {
    this.userId = userId;
  }

  public LocalDateTime getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(LocalDateTime createdAt) {
    this.createdAt = createdAt;
  }
}
