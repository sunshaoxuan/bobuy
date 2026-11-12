package com.bobbuy.service;

import com.bobbuy.model.RecommendationItem;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

/** Consumer projection only; never writes historical facts or checkout quotes. */
public record ReferencePriceDisplay(BigDecimal amount,BigDecimal originalPrice,BigDecimal discountAmount,String state) {
 public static ReferencePriceDisplay of(RecommendationItem facts,Instant now){
  var window=ReferenceOfferWindow.resolve(facts.offerStart,facts.offerEnd,facts.referenceContext);
  var today=now.atZone(ZoneId.of("Asia/Tokyo")).toLocalDate();
  var state=window.end()!=null&&today.isAfter(window.end())?"EXPIRED":window.start()!=null&&today.isBefore(window.start())?"FUTURE":window.complete()?"ACTIVE":"UNKNOWN";
  var amount=facts.referencePrice;var original=facts.originalPrice;
  boolean discount=amount!=null&&(original!=null&&original.compareTo(amount)>0||facts.discountAmount!=null&&facts.discountAmount.signum()>0);
  boolean outside=state.equals("EXPIRED")||state.equals("FUTURE");
  var shown=amount==null?null:discount&&outside?original!=null&&original.compareTo(amount)>=0?original:null:amount;
  var strike=discount&&!outside&&original!=null&&original.compareTo(amount)>0?original:null;
  return new ReferencePriceDisplay(shown,strike,strike==null?null:strike.subtract(amount),state);
 }
 public static Optional<PublicProductCatalogService.Offer> main(PublicProductCatalogService.Entry entry){
  return entry.referenceOffers().stream()
   .filter(row->Objects.equals(row.facts().productId,entry.productId())&&Objects.equals(row.facts().itemNumber,entry.itemNumber()))
   .sorted(Comparator.comparingInt((PublicProductCatalogService.Offer row)->channel(row.facts())).thenComparing(PublicProductCatalogService.Offer::postId,Comparator.reverseOrder()).thenComparing(row->row.facts().id,Comparator.reverseOrder())).findFirst();
 }
 private static int channel(RecommendationItem facts){var c=facts.referenceContext==null?null:facts.referenceContext.channel();return "COSTCO_WAREHOUSE".equals(c)?0:"COSTCO_ONLINE".equals(c)?1:2;}
}
