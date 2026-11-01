package com.bobbuy.model;

import java.time.LocalDate;
import jakarta.validation.constraints.Size;

/** Reviewed source facts, never a receipt-time default or permission to sell. */
public record ReferenceOfferContext(
 @Size(max=255) String supplierKey, @Size(max=40) String channel,
 @Size(max=1000) String variantKey, @Size(max=1024) String sourceMessageKey,
 @Size(max=2048) String sourceUrl,
 @org.springframework.format.annotation.DateTimeFormat(iso=org.springframework.format.annotation.DateTimeFormat.ISO.DATE) LocalDate activityStart,
 @org.springframework.format.annotation.DateTimeFormat(iso=org.springframework.format.annotation.DateTimeFormat.ISO.DATE) LocalDate activityEnd,
 Boolean activityApplies, @Size(max=2000) String windowEvidence, Boolean startSearchComplete) {
 public ReferenceOfferContext {
  activityApplies=Boolean.TRUE.equals(activityApplies);
  startSearchComplete=Boolean.TRUE.equals(startSearchComplete);
 }
}
