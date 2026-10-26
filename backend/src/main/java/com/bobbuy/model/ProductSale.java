package com.bobbuy.model;
import java.math.BigDecimal;
import java.time.*;
/** An operator-confirmed selling quote, independent of source/reference facts. */
public record ProductSale(BigDecimal amount,String currency,String unit,LocalDate validFrom,
 LocalDate validThrough,long revision,Long reviewedBy,Instant reviewedAt,boolean enabled) {}
