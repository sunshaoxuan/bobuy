package com.bobbuy.service;

import com.bobbuy.model.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

/** One price-change resolution rule for sales, reference display and promotion badges. */
public final class PriceAdjustmentResolver {
 private PriceAdjustmentResolver(){}
 public record Price(BigDecimal amount,BigDecimal regular,ProductPriceAdjustment document,Instant nextChange){
  public boolean promotion(){return document!=null&&document.type==ProductPriceAdjustment.Type.PROMOTION&&regular!=null&&amount.compareTo(regular)<0;}
 }
 public static boolean approvedAt(ProductPriceAdjustment d,Instant now){return d.status==ProductPriceAdjustment.Status.APPROVED&&d.approvedAt!=null&&!now.isBefore(d.approvedAt)&&d.startsAt!=null&&!now.isBefore(d.startsAt)&&(d.endsAt==null||now.isBefore(d.endsAt));}
 public static Price resolve(List<ProductPriceAdjustment> source,String productId,Long owner,String channel,String currency,String unit,BigDecimal base,Instant now){
  var documents=source.stream().filter(d->Objects.equals(d.merchantId,owner)&&Objects.equals(d.channel,channel)&&Objects.equals(d.currency,currency))
   .filter(d->d.line(productId)!=null&&Objects.equals(d.line(productId).unit,unit)).toList();
  var permanent=documents.stream().filter(d->d.type==ProductPriceAdjustment.Type.PERMANENT&&approvedAt(d,now))
   .max(Comparator.comparing((ProductPriceAdjustment d)->d.startsAt).thenComparing(d->d.id)).orElse(null);
  BigDecimal regular=permanent==null?base:permanent.line(productId).amount;
  var overlays=documents.stream().filter(d->d.type!=ProductPriceAdjustment.Type.PERMANENT&&approvedAt(d,now)).toList();
  if(overlays.size()>1)throw new IllegalStateException("Overlapping approved price documents");
  var chosen=overlays.isEmpty()?permanent:overlays.get(0);
  var line=chosen==null?null:chosen.line(productId);
  if(regular==null&&line!=null)regular=line.beforeAmount;
  BigDecimal amount=line==null?regular:line.amount;
  // A promotion can never raise the currently effective regular price.
  if(chosen!=null&&chosen.type==ProductPriceAdjustment.Type.PROMOTION&&(regular==null||amount==null||amount.compareTo(regular)>=0)){chosen=permanent;amount=regular;}
  Instant next=documents.stream().filter(d->d.status==ProductPriceAdjustment.Status.APPROVED&&d.startsAt!=null)
   .flatMap(d->java.util.stream.Stream.of(d.startsAt,d.endsAt)).filter(Objects::nonNull).filter(t->t.isAfter(now)).min(Comparator.naturalOrder()).orElse(null);
  return new Price(amount,regular,chosen,next);
 }
}
