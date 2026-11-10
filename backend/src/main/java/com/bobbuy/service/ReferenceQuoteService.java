package com.bobbuy.service;

import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

/** Supplier reference quotations only. Never writes ProductSale or adjusts inventory. */
@Service
public class ReferenceQuoteService {
 private final ReferenceQuoteRevisionRepository history;private final ObjectMapper json;
 private final RecommendationItemRepository items;private final RecommendationPostRepository posts;
 public ReferenceQuoteService(ReferenceQuoteRevisionRepository history,ObjectMapper json,RecommendationItemRepository items,RecommendationPostRepository posts){this.history=history;this.json=json;this.items=items;this.posts=posts;}
 public record Resolution(String state,BigDecimal amount,List<Long> itemIds,int unknownWindows){}
 public void snapshot(RecommendationItem item,Long owner){
  if(item.id==null)return;var facts=payload(item);String hash=digest(facts);
  if(history.findFirstByItemIdOrderByIdDesc(item.id).filter(prior->prior.factsHash.equals(hash)).isPresent())return;
  var row=new ReferenceQuoteRevision();row.merchantId=owner;row.postId=item.postId;row.itemId=item.id;row.productId=item.productId;row.factsHash=hash;row.facts=facts;row.recordedAt=Instant.now();history.saveAndFlush(row);
 }
 private Map<String,Object> payload(RecommendationItem i){var result=new TreeMap<String,Object>();
  result.put("name",i.name);result.put("itemNumber",i.itemNumber);result.put("productId",i.productId);
  result.put("sourceImageHash",i.imageHash);result.put("sourceImageUrl",i.imageUrl);
  result.put("referencePrice",i.referencePrice);result.put("originalPrice",i.originalPrice);result.put("discountAmount",i.discountAmount);result.put("priceUnit",i.priceUnit);
  result.put("offerStart",Objects.toString(i.offerStart,null));result.put("offerEnd",Objects.toString(i.offerEnd,null));result.put("couponStart",Objects.toString(i.couponStart,null));result.put("couponEnd",Objects.toString(i.couponEnd,null));result.put("offerNotes",i.offerNotes);result.put("context",i.referenceContext);return result;
 }
 private String digest(Object value){try{return MediaBinaryService.sha(json.writeValueAsBytes(value));}catch(Exception error){throw new IllegalStateException("Reference identity encoding failed",error);}}
 public String identity(RecommendationItem i){
  var identity=new TreeMap<String,Object>();identity.put("product",i.productId==null?i.itemNumber:i.productId);identity.put("unlinkedName",i.productId==null?i.name:null);var c=i.referenceContext;if(c!=null){identity.put("supplier",c.supplierKey());identity.put("channel",c.channel());identity.put("variant",c.variantKey());identity.put("message",c.sourceMessageKey());}identity.put("unit",i.priceUnit);var window=ReferenceOfferWindow.resolve(i.offerStart,i.offerEnd,c);identity.put("start",Objects.toString(window.start(),null));identity.put("end",Objects.toString(window.end(),null));identity.put("couponStart",Objects.toString(i.couponStart,null));identity.put("couponEnd",Objects.toString(i.couponEnd,null));return digest(identity);
 }
 public List<ReferenceQuoteRevision> history(Long owner,Long itemId){return history.findByMerchantIdAndItemIdOrderById(owner,itemId);}
 /** The caller already filters deleted masters and authorizes the displayed issue. */
 public void decorate(List<RecommendationItem> visible,boolean publicView){
  var productIds=visible.stream().map(i->i.productId).filter(Objects::nonNull).distinct().toList();
  var published=new HashSet<>(posts.findByPublishedTrue().stream().map(p->p.id).toList());
  var candidates=productIds.isEmpty()?List.<RecommendationItem>of():items.findByProductIdInOrderById(productIds).stream()
   .filter(i->published.contains(i.postId)&&RecommendationPublication.visible(i))
   // Catalog metadata owns the display, not the source ITEM identity of a historical quote.
   .map(i->{var source=RecommendationPublication.project(i,i.publicationSnapshot);source.itemNumber=i.publicationSnapshot.itemNumber();return source;}).toList();
  var now=Instant.now();for(var item:visible){item.referenceQuote=resolve(item,candidates,now);if(publicView&&item.referenceContext!=null){var c=item.referenceContext;item.referenceContext=new ReferenceOfferContext(null,c.channel(),null,null,c.sourceUrl(),c.activityStart(),c.activityEnd(),c.activityApplies(),c.windowEvidence(),c.startSearchComplete());}}
 }
 private static boolean filled(String s){return s!=null&&!s.isBlank();}
 private static boolean scoped(RecommendationItem i){var c=i.referenceContext;return i.productId!=null&&c!=null&&filled(c.supplierKey())&&filled(c.channel())&&filled(c.variantKey())&&filled(c.sourceMessageKey())&&filled(i.priceUnit);}
 private static boolean sameScope(RecommendationItem a,RecommendationItem b){
  if(!scoped(a)||!scoped(b))return false;var x=a.referenceContext;var y=b.referenceContext;
  return a.productId.equals(b.productId)&&Objects.equals(a.itemNumber,b.itemNumber)&&x.supplierKey().equals(y.supplierKey())&&x.channel().equals(y.channel())&&x.variantKey().equals(y.variantKey())&&a.priceUnit.equals(b.priceUnit);
 }
 public static Resolution resolve(RecommendationItem target,List<RecommendationItem> candidates,Instant now){
  if(!scoped(target))return new Resolution("UNSCOPED",null,List.of(),0);
  var matching=candidates.stream().filter(i->sameScope(target,i)).toList();
  int unknown=(int)matching.stream().filter(i->!ReferenceOfferWindow.resolve(i.offerStart,i.offerEnd,i.referenceContext).complete()).count();
  // Coupon eligibility is not an unconditional product price.
  var active=matching.stream().filter(i->i.couponStart==null&&i.couponEnd==null&&i.referencePrice!=null&&"ACTIVE".equals(ReferenceOfferWindow.resolve(i.offerStart,i.offerEnd,i.referenceContext).state(now))).toList();
  if(active.isEmpty())return new Resolution(unknown>0?"UNKNOWN":"NO_ACTIVE_OFFER",null,List.of(),unknown);
  var amount=active.get(0).referencePrice;var ids=active.stream().map(i->i.id).toList();
  if(active.stream().anyMatch(i->i.referencePrice.compareTo(amount)!=0))return new Resolution("CONFLICT",null,ids,unknown);
  return new Resolution("ACTIVE",amount,ids,unknown);
 }
}
