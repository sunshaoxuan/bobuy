package com.bobbuy.test;
import com.bobbuy.model.*;
import com.bobbuy.repository.ProductPriceAdjustmentRepository;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
/** Synthetic source evidence and canonical document views for tests after item date-column removal. */
public final class PriceDocumentFixtures {
 private PriceDocumentFixtures(){}
 public static LocalDate start(RecommendationItem i){return i.sourcePrice==null?null:i.sourcePrice.start();}
 public static LocalDate end(RecommendationItem i){return i.sourcePrice==null?null:i.sourcePrice.end();}
 public static void start(RecommendationItem i,LocalDate d){window(i,d,end(i));}
 public static void end(RecommendationItem i,LocalDate d){window(i,start(i),d);}
 public static void window(RecommendationItem i,LocalDate a,LocalDate b){
  i.sourcePrice=new RecommendationItem.SourcePrice(i.referencePrice,i.originalPrice,i.discountAmount,i.priceUnit,a,b);
  i.priceChange=new RecommendationItem.PriceChange(1L,"TEST-PC-1","PROMOTION",a==null||b==null?"UNKNOWN":"ACTIVE",a==null?null:a.atStartOfDay(ZoneId.of("Asia/Tokyo")).toInstant(),b==null?null:b.plusDays(1).atStartOfDay(ZoneId.of("Asia/Tokyo")).toInstant(),i.referencePrice,i.originalPrice,i.referencePrice,i.originalPrice!=null&&i.referencePrice!=null&&i.originalPrice.compareTo(i.referencePrice)>0);
 }
 public static ProductPriceAdjustment approvedReference(RecommendationItem i,Long owner,String channel){
  var d=new ProductPriceAdjustment();d.merchantId=owner;d.channel=channel;d.currency="JPY";d.documentNumber="SYNTHETIC-REFERENCE-"+i.id;d.type=ProductPriceAdjustment.Type.TEMPORARY;d.status=ProductPriceAdjustment.Status.APPROVED;d.startsAt=Instant.parse("2000-01-01T00:00:00Z");d.endsAt=Instant.parse("2099-01-01T00:00:00Z");d.approvedAt=d.startsAt;d.createdAt=d.startsAt;d.sourceNote="Synthetic separately reviewed supplier quote";d.evidence.put("sourceItemNumber",i.itemNumber);
  var l=new ProductPriceAdjustmentLine();l.document=d;l.productId=i.productId;l.referenceItemId=i.id;l.amount=i.referencePrice;l.beforeAmount=i.originalPrice;l.unit=i.priceUnit;d.lines.add(l);return d;
 }
 @SuppressWarnings("unchecked") public static ProductPriceAdjustmentRepository repository(){
  var rows=new LinkedHashMap<Long,ProductPriceAdjustment>();var sequence=new AtomicLong();
  return (ProductPriceAdjustmentRepository)java.lang.reflect.Proxy.newProxyInstance(ProductPriceAdjustmentRepository.class.getClassLoader(),new Class[]{ProductPriceAdjustmentRepository.class},(proxy,method,args)->{
   String name=method.getName();if(name.equals("toString"))return "Synthetic price document repository";
   if(name.equals("saveAndFlush")||name.equals("save")){var d=(ProductPriceAdjustment)args[0];if(d.id==null)d.id=sequence.incrementAndGet();rows.put(d.id,d);return d;}
   var sorted=rows.values().stream().sorted(Comparator.comparing((ProductPriceAdjustment d)->d.id).reversed()).toList();
   if(name.equals("findById"))return Optional.ofNullable(rows.get(args[0]));
   if(name.equals("findByMerchantIdAndSourceKey"))return sorted.stream().filter(d->Objects.equals(d.merchantId,args[0])&&Objects.equals(d.sourceKey,args[1])).findFirst();
   if(name.equals("forReferenceItem"))return sorted.stream().filter(d->d.lines.stream().anyMatch(l->Objects.equals(l.referenceItemId,args[0]))).toList();
   if(name.equals("forReferences"))return sorted.stream().filter(d->d.lines.stream().anyMatch(l->((Collection<?>)args[0]).contains(l.referenceItemId))).toList();
   if(name.equals("forProducts"))return sorted.stream().filter(d->d.lines.stream().anyMatch(l->((Collection<?>)args[0]).contains(l.productId))).toList();
   if(name.equals("findByProductIdOrderByCreatedAtDescIdDesc"))return sorted.stream().filter(d->d.line((String)args[0])!=null).toList();
   if(method.getReturnType()==Optional.class)return Optional.empty();if(List.class.isAssignableFrom(method.getReturnType()))return List.of();if(method.getReturnType()==boolean.class)return false;if(method.getReturnType()==long.class)return 0L;return null;
  });
 }
}
