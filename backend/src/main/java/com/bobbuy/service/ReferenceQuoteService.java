package com.bobbuy.service;

import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

/** Imported facts produce draft price documents; reads resolve documents exclusively. */
@Service
public class ReferenceQuoteService {
 private final ReferenceQuoteRevisionRepository history;private final ObjectMapper json;private final ProductPriceAdjustmentRepository adjustments;private final RecommendationItemRepository items;private final RecommendationPostRepository posts;
 public ReferenceQuoteService(ReferenceQuoteRevisionRepository h,ObjectMapper j,RecommendationItemRepository i,RecommendationPostRepository p,ProductPriceAdjustmentRepository a){history=h;json=j;items=i;posts=p;adjustments=a;}
 public record Resolution(String state,BigDecimal amount,List<Long> itemIds,int unknownWindows){}
 public record CurrentPrice(Long documentId,String documentNumber,String channel,String currency,String unit,BigDecimal amount,BigDecimal regularAmount,boolean promotion,Instant startsAt,Instant endsAt,String type,String state){}
 /** Manual approved reference documents also work for products without a recommendation occurrence. */
 public Map<String,List<CurrentPrice>> currentPrices(Collection<Product> products){
  if(products.isEmpty())return Map.of();var ids=products.stream().map(Product::getId).toList();var rows=adjustments.forProducts(ids);var now=Instant.now();var result=new HashMap<String,List<CurrentPrice>>();
  for(var product:products){var documents=rows.stream().filter(d->Objects.equals(d.merchantId,product.getMerchantId())&&Set.of("COSTCO_WAREHOUSE","COSTCO_ONLINE").contains(d.channel)&&d.line(product.getId())!=null)
    .filter(d->d.evidence.get("sourceItemNumber")==null||Objects.equals(d.evidence.get("sourceItemNumber"),product.getItemNumber())).toList();
   var scopes=new LinkedHashMap<List<String>,ProductPriceAdjustment>();for(var d:documents)if(PriceAdjustmentResolver.approvedAt(d,now)){var line=d.line(product.getId());if(line.unit!=null)scopes.putIfAbsent(List.of(d.channel,d.currency,line.unit),d);}
   var prices=new ArrayList<CurrentPrice>();for(var scope:scopes.keySet()){
    var price=PriceAdjustmentResolver.resolve(documents,product.getId(),product.getMerchantId(),scope.get(0),scope.get(1),scope.get(2),null,now);var d=price.document();if(d!=null&&price.amount()!=null)prices.add(new CurrentPrice(d.id,d.documentNumber,d.channel,d.currency,scope.get(2),price.amount(),price.regular(),price.promotion(),d.startsAt,d.endsAt,d.type.name(),"ACTIVE"));
   }
   prices.sort(Comparator.comparingInt((CurrentPrice p)->p.channel().equals("COSTCO_WAREHOUSE")?0:1).thenComparingInt(p->p.currency().equals(product.getCurrency())?0:1).thenComparing(CurrentPrice::startsAt,Comparator.reverseOrder()).thenComparing(CurrentPrice::documentId,Comparator.reverseOrder()));result.put(product.getId(),List.copyOf(prices));
  }return result;
 }
 private String digest(Object value){try{return MediaBinaryService.sha(json.writeValueAsBytes(value));}catch(Exception error){throw new IllegalStateException("Reference identity encoding failed",error);}}
 @Transactional public void snapshot(RecommendationItem item,Long owner){
  if(item.id==null)return;
  persistSource(item,owner);
  var facts=new TreeMap<String,Object>();facts.put("name",item.name);facts.put("itemNumber",item.itemNumber);facts.put("productId",item.productId);facts.put("sourceImageHash",item.imageHash);facts.put("sourceImageUrl",item.imageUrl);facts.put("priceDocuments",adjustments.forReferenceItem(item.id).stream().map(d->Map.of("id",d.id,"version",d.version)).toList());facts.put("sourcePrice",item.sourcePrice);facts.put("couponStart",Objects.toString(item.couponStart,null));facts.put("couponEnd",Objects.toString(item.couponEnd,null));facts.put("offerNotes",item.offerNotes);facts.put("context",item.referenceContext);
  String hash=digest(facts);if(history.findFirstByItemIdOrderByIdDesc(item.id).filter(p->p.factsHash.equals(hash)).isPresent())return;
  var row=new ReferenceQuoteRevision();row.merchantId=owner;row.postId=item.postId;row.itemId=item.id;row.productId=item.productId;row.factsHash=hash;row.facts=facts;row.recordedAt=Instant.now();history.saveAndFlush(row);
 }
 private void persistSource(RecommendationItem item,Long owner){
  var source=item.sourcePrice;if(source==null||source.amount()==null&&source.original()==null&&source.reduction()==null&&source.unit()==null&&source.start()==null&&source.end()==null)return;
  if(adjustments.forReferenceItem(item.id).stream().anyMatch(d->Objects.equals(d.merchantId,owner)&&d.evidence.get("sourcePrice")!=null&&source.equals(json.convertValue(d.evidence.get("sourcePrice"),RecommendationItem.SourcePrice.class))))return;
  String key="source-item:"+item.id+":"+digest(source);if(adjustments.findByMerchantIdAndSourceKey(owner,key).isPresent())return;
  var c=item.referenceContext;var window=ReferenceOfferWindow.resolve(source.start(),source.end(),c);
  var d=new ProductPriceAdjustment();d.merchantId=owner;d.channel=c==null||c.channel()==null?"UNRESOLVED":c.channel();d.currency="JPY";d.sourceKey=key;d.documentNumber="PC-"+UUID.randomUUID();d.createdBy=owner;d.updatedBy=owner;d.createdAt=Instant.now();d.updatedAt=d.createdAt;
  BigDecimal before=source.original()!=null?source.original():source.amount()!=null&&source.reduction()!=null?source.amount().add(source.reduction()):null;
  d.type=before!=null&&source.amount()!=null&&before.compareTo(source.amount())>0?ProductPriceAdjustment.Type.PROMOTION:window.end()!=null?ProductPriceAdjustment.Type.TEMPORARY:ProductPriceAdjustment.Type.PERMANENT;
  d.startsAt=window.start()==null?null:window.start().atStartOfDay(ZoneId.of("Asia/Tokyo")).toInstant();d.endsAt=d.type==ProductPriceAdjustment.Type.PERMANENT?null:window.end()==null?null:window.end().plusDays(1).atStartOfDay(ZoneId.of("Asia/Tokyo")).toInstant();
  d.sourceNote="来源报价录入，待核实调价原因";if(item.offerNotes!=null&&!item.offerNotes.isBlank())d.sourceNote=("来源报价录入："+item.offerNotes).substring(0,Math.min(1000,7+item.offerNotes.length()));
  d.evidence.put("reviewRequired",true);d.evidence.put("sourceItemId",item.id);d.evidence.put("sourcePostId",item.postId);if(item.itemNumber!=null)d.evidence.put("sourceItemNumber",item.itemNumber);d.evidence.put("sourcePrice",json.convertValue(source,Map.class));if(c!=null)d.evidence.put("sourceContext",json.convertValue(c,Map.class));
  var line=new ProductPriceAdjustmentLine();line.document=d;line.productId=item.productId;line.referenceItemId=item.id;line.amount=source.amount();line.beforeAmount=before;line.unit=source.unit();d.lines.add(line);adjustments.saveAndFlush(d);
 }
 public String identity(RecommendationItem i){
  if(i.sourcePrice==null&&i.offerIdentity!=null)return i.offerIdentity;
  var identity=new TreeMap<String,Object>();identity.put("product",i.productId==null?i.itemNumber:i.productId);identity.put("unlinkedName",i.productId==null?i.name:null);var c=i.referenceContext;if(c!=null){identity.put("supplier",c.supplierKey());identity.put("channel",c.channel());identity.put("variant",c.variantKey());identity.put("message",c.sourceMessageKey());}var source=i.sourcePrice;identity.put("unit",source==null?null:source.unit());var window=ReferenceOfferWindow.resolve(source==null?null:source.start(),source==null?null:source.end(),c);identity.put("start",Objects.toString(window.start(),null));identity.put("end",Objects.toString(window.end(),null));identity.put("couponStart",Objects.toString(i.couponStart,null));identity.put("couponEnd",Objects.toString(i.couponEnd,null));return digest(identity);
 }
 public List<ReferenceQuoteRevision> history(Long owner,Long itemId){return history.findByMerchantIdAndItemIdOrderById(owner,itemId);}
 @Transactional public void relinkDraftSource(RecommendationItem item,Long owner,String productId){
  for(var d:adjustments.forReferenceItem(item.id)){
   if(!Objects.equals(d.merchantId,owner))throw new IllegalStateException("Source document owner mismatch");
   if(d.status!=ProductPriceAdjustment.Status.DRAFT)throw new com.bobbuy.api.response.ApiException(com.bobbuy.api.response.ErrorCode.INVALID_REQUEST,"pricing.immutable");
   for(var line:d.lines)if(Objects.equals(line.referenceItemId,item.id)){d.evidence.putIfAbsent("originalProductId",Objects.toString(line.productId,""));line.productId=productId;}
   d.updatedAt=Instant.now();d.updatedBy=owner;adjustments.saveAndFlush(d);
  }
 }
 public void decorate(List<RecommendationItem> visible,boolean publicView){
  var byItem=new HashMap<Long,ProductPriceAdjustment>();
  var itemIds=visible.stream().map(i->i.id).filter(Objects::nonNull).distinct().toList();
  if(!itemIds.isEmpty())for(var d:adjustments.forReferences(itemIds))if(!"STOREFRONT".equals(d.channel))for(var line:d.lines)if(line.referenceItemId!=null)byItem.putIfAbsent(line.referenceItemId,d);
  var productIds=visible.stream().map(i->i.productId).filter(Objects::nonNull).distinct().toList();
  var byProduct=new HashMap<String,List<ProductPriceAdjustment>>();if(!productIds.isEmpty())for(var d:adjustments.forProducts(productIds))for(var line:d.lines)if(line.productId!=null)byProduct.computeIfAbsent(line.productId,k->new ArrayList<>()).add(d);
  var owners=new HashMap<Long,Long>();posts.findAllById(visible.stream().map(i->i.postId).filter(Objects::nonNull).distinct().toList()).forEach(p->owners.put(p.id,p.merchantId));
  var now=Instant.now();for(var item:visible){
   item.referencePrice=null;item.originalPrice=null;item.discountAmount=null;item.priceUnit=null;item.priceChange=null;
   if(publicView&&item.referenceContext!=null){var c=item.referenceContext;item.referenceContext=new ReferenceOfferContext(null,c.channel(),null,null,c.sourceUrl(),null,null,false,null,false);}
   var source=byItem.get(item.id);
   if(source==null||!Objects.equals(source.merchantId,owners.get(item.postId))||source.evidence.get("sourceItemNumber")!=null&&!Objects.equals(source.evidence.get("sourceItemNumber"),item.itemNumber)){item.referenceQuote=new Resolution("UNKNOWN",null,List.of(),1);continue;}
   var line=source.lines.stream().filter(l->Objects.equals(l.referenceItemId,item.id)&&Objects.equals(l.productId,item.productId)).findFirst().orElse(null);if(line==null)continue;
   if(source.evidence.get("sourcePrice")!=null)item.sourcePrice=json.convertValue(source.evidence.get("sourcePrice"),RecommendationItem.SourcePrice.class);
   var all=(item.productId==null?List.of(source):byProduct.getOrDefault(item.productId,List.of())).stream().filter(d->d.evidence.get("sourceItemNumber")==null||Objects.equals(d.evidence.get("sourceItemNumber"),item.itemNumber)).toList();
   var price=PriceAdjustmentResolver.resolve(all,item.productId,source.merchantId,source.channel,source.currency,line.unit,null,now);
   if(publicView&&price.document()==null&&source.status!=ProductPriceAdjustment.Status.APPROVED){item.referenceQuote=new Resolution("UNKNOWN",null,List.of(),1);continue;}
   var shown=price.document()==null?source:price.document();var shownLine=shown.line(item.productId);if(shownLine==null)shownLine=line;
   String state=shown.status!=ProductPriceAdjustment.Status.APPROVED?"UNKNOWN":shown.startsAt==null?"UNKNOWN":now.isBefore(shown.startsAt)?"FUTURE":shown.endsAt!=null&&!now.isBefore(shown.endsAt)?"EXPIRED":"ACTIVE";
   BigDecimal effective=price.amount();if(effective==null&&source.type!=ProductPriceAdjustment.Type.PERMANENT&&source.endsAt!=null&&!now.isBefore(source.endsAt))effective=line.beforeAmount;
   item.referencePrice=effective==null?line.amount:effective;item.originalPrice=price.promotion()?price.regular():null;item.discountAmount=item.originalPrice==null||item.referencePrice==null?null:item.originalPrice.subtract(item.referencePrice);item.priceUnit=line.unit;
   item.priceChange=new RecommendationItem.PriceChange(shown.id,shown.documentNumber,shown.type.name(),state,shown.startsAt,shown.endsAt,shownLine.amount,shownLine.beforeAmount,effective,price.promotion());
   item.referenceQuote=new Resolution(price.amount()==null?state:"ACTIVE",price.amount(),List.of(item.id),state.equals("UNKNOWN")?1:0);
  }
 }
}
