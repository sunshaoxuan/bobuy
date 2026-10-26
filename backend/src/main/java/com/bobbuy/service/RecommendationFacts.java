package com.bobbuy.service;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import com.bobbuy.api.response.*;
import com.bobbuy.model.RecommendationItem;

/** Facts copied from the source. Null means not stated, never zero or an inferred date. */
public record RecommendationFacts(
    @NotBlank @Size(max=200) String name,
    @Size(max=255) @com.fasterxml.jackson.databind.annotation.JsonDeserialize(using=RecommendationString.class) String itemNumber,
    @DecimalMin("0") @Digits(integer=12, fraction=2) BigDecimal referencePrice,
    @DecimalMin("0") @Digits(integer=12, fraction=2) BigDecimal originalPrice,
    @DecimalMin("0") @Digits(integer=12, fraction=2) BigDecimal discountAmount,
    @Size(max=100) String priceUnit,
    @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate offerStart,
    @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate offerEnd,
    @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate couponStart,
    @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate couponEnd,
    @Size(max=2000) String offerNotes
) {
    public void apply(RecommendationItem item) {
        if ((offerStart != null && offerEnd != null && offerStart.isAfter(offerEnd))
                || (couponStart != null && couponEnd != null && couponStart.isAfter(couponEnd))
                || (originalPrice != null && referencePrice != null && originalPrice.compareTo(referencePrice) < 0))
            throw new ApiException(ErrorCode.INVALID_REQUEST, "error.recommendation.offer");
        item.name = name.trim(); item.itemNumber = clean(itemNumber); item.referencePrice = referencePrice;
        item.originalPrice = originalPrice; item.discountAmount = discountAmount; item.priceUnit = clean(priceUnit);
        item.offerStart = offerStart; item.offerEnd = offerEnd; item.couponStart = couponStart; item.couponEnd = couponEnd;
        item.offerNotes = clean(offerNotes);
    }
    private static String clean(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}
