package com.bobbuy.model;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Immutable issue facts and the exact reviewed master projection used for this occurrence. */
public record RecommendationPublicationSnapshot(
    int version, boolean legacy, Long productVersion, String productSourceHash, String reviewHash,
    String name, String itemNumber, String specification, String description,
    Map<String,RecommendationItem.Text> translations, String translatedSource,
    BigDecimal referencePrice, BigDecimal originalPrice, BigDecimal discountAmount, String priceUnit,
    LocalDate offerStart, LocalDate offerEnd, LocalDate couponStart, LocalDate couponEnd,
    String offerNotes, ReferenceOfferContext referenceContext, List<RecommendationItem.Picture> gallery,
    List<String> categoryIds, String supplierId, boolean showSupplier,
    String imageHash, String imageUrl, String offerIdentity, ProductCatalogRecovery.State catalog) {}
