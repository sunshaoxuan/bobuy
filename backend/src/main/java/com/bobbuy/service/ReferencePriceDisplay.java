package com.bobbuy.service;
import com.bobbuy.model.RecommendationItem;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
/** All amounts and promotion status are document projections, never publication-snapshot fallbacks. */
public record ReferencePriceDisplay(BigDecimal amount,BigDecimal originalPrice,BigDecimal discountAmount,String state) {
 public static ReferencePriceDisplay of(RecommendationItem facts,Instant now){
  var p=facts.priceChange;if(p==null)return new ReferencePriceDisplay(null,null,null,"UNKNOWN");
  String state=p.state().equals("UNKNOWN")?"UNKNOWN":p.startsAt()!=null&&now.isBefore(p.startsAt())?"FUTURE":p.endsAt()!=null&&!now.isBefore(p.endsAt())?"EXPIRED":p.state();
  BigDecimal shown=state.equals("EXPIRED")||state.equals("FUTURE")?p.beforeAmount():p.effectiveAmount()!=null?p.effectiveAmount():p.amount();
  BigDecimal original=p.promotion()&&state.equals("ACTIVE")?p.beforeAmount():null;
  return new ReferencePriceDisplay(shown,original,original==null||shown==null?null:original.subtract(shown),state);
 }
 public static Optional<PublicProductCatalogService.Offer> main(PublicProductCatalogService.Entry e){return e.referenceOffers().stream().filter(r->Objects.equals(r.facts().productId,e.productId())&&Objects.equals(r.facts().itemNumber,e.itemNumber())).sorted(Comparator.comparingInt((PublicProductCatalogService.Offer r)->channel(r.facts())).thenComparing(PublicProductCatalogService.Offer::postId,Comparator.reverseOrder()).thenComparing(r->r.facts().id,Comparator.reverseOrder())).findFirst();}
 private static int channel(RecommendationItem i){String c=i.referenceContext==null?null:i.referenceContext.channel();return "COSTCO_WAREHOUSE".equals(c)?0:"COSTCO_ONLINE".equals(c)?1:2;}
}
