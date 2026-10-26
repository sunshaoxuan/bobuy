package com.bobbuy.model;
import java.time.Instant;
import java.util.*;
/** Additional product metadata; names/descriptions/images remain on Product. */
public record ProductCatalogData(Map<String,String> specification,String model,String packaging,
 List<String> categoryIds,String supplierId,String translatedSource,Long reviewedBy,Instant reviewedAt) {}
