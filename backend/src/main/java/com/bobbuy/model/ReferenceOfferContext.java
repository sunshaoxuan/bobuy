package com.bobbuy.model;

import java.time.LocalDate;
import jakarta.validation.constraints.Size;

/** Reviewed source facts, never a receipt-time default or permission to sell. */
public record ReferenceOfferContext(
 @Size(max=255) String supplierKey, @Size(max=40) String channel,
 @Size(max=1000) String variantKey, @Size(max=1024) String sourceMessageKey,
 @Size(max=2048) String sourceUrl, LocalDate activityStart, LocalDate activityEnd,
 boolean activityApplies, @Size(max=2000) String windowEvidence, boolean startSearchComplete) {}
