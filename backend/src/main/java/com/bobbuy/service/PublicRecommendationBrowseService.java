package com.bobbuy.service;
import com.bobbuy.model.*;
import com.fasterxml.jackson.databind.*;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

/** Occurrences are (postId,itemId), never deduplicated across distinct published offers. */
@Service
public class PublicRecommendationBrowseService {
 private final RecommendationService recommendations;private final ProductRatingService ratings;private final ProductPopularityService popularity;private final PublicBrowsePriceService prices;
 private final ObjectMapper json=new ObjectMapper().findAndRegisterModules().configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS,true).configure(MapperFeature.SORT_PROPERTIES_ALPHABETICALLY,true);
 public PublicRecommendationBrowseService(RecommendationService r){this(r,null,null,null);}
 public PublicRecommendationBrowseService(RecommendationService r,ProductRatingService ratings){this(r,ratings,null,null);}
 @org.springframework.beans.factory.annotation.Autowired public PublicRecommendationBrowseService(RecommendationService r,ProductRatingService ratings,ProductPopularityService popularity,PublicBrowsePriceService prices){recommendations=r;this.ratings=ratings;this.popularity=popularity;this.prices=prices;}
 private Map<String,java.math.BigDecimal> ratings(List<RecommendationService.Detail> data){var owners=new HashMap<String,Long>();for(var d:data)for(var i:d.items())if(i.productId!=null)owners.put(i.productId,d.post().merchantId());return ratings==null?Map.of():ratings.publicRatings(owners);}
 /** itemCount is the legacy query-match count; publicItemCount is the whole issue's public product occurrences. */
 public record SupplierLabel(String id,Map<String,String> name){}
 public record Issue(RecommendationService.Summary post,String title,boolean history,long itemCount,boolean service,
   long publicItemCount,List<SupplierLabel> suppliers,LocalDate issueDate,String issueDateSource){}
 public record Directory(List<Issue> items,int page,int size,long total,boolean hasNext,String revision,String japanDay,String datasetRevision){}
 public record ItemCard(Long id,String productId,String name,String brand,String itemNumber,String specification,String model,String packaging,
   Map<String,RecommendationItem.Text> translations,String translationStatus,List<RecommendationItem.Label> categories,
   RecommendationItem.Picture image,java.math.BigDecimal referencePrice,java.math.BigDecimal originalPrice,java.math.BigDecimal discountAmount,
   String priceUnit,String currency,LocalDate offerStart,LocalDate offerEnd,LocalDate couponStart,LocalDate couponEnd,String offerNotes,
   ReferenceOfferContext referenceContext,ReferenceQuoteService.Resolution referenceQuote,java.math.BigDecimal rating){}
 public record ServiceCard(String provider,Integer staff,java.math.BigDecimal hours,java.math.BigDecimal originalPrice,
   java.math.BigDecimal price,String currency,Boolean taxIncluded,List<RecommendationServiceOffer.Fee> fees,boolean noExtraFees,
   LocalDate applicationStart,LocalDate applicationEnd,LocalDate serviceStart,LocalDate serviceEnd,RecommendationServiceOffer.Basis basis,List<RecommendationServiceOffer.PackageOption> packages){}
 public record Occurrence(String key,RecommendationService.Summary post,String title,boolean history,ItemCard item,boolean service,ServiceCard serviceSummary){}
 public record Page(List<Occurrence> items,int page,int size,long scopeTotal,long matchedTotal,long productOccurrences,long serviceCards,
   boolean hasNext,String revision,List<PublicProductBrowseService.Facet> categories,long unclassified,String japanDay,String datasetRevision){}
 private record Row(RecommendationService.Detail detail,RecommendationItem item,boolean history){}
 private String revision(Object value){try{return HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(json.writeValueAsBytes(value)));}catch(Exception e){throw new IllegalStateException("Cannot version recommendation browse",e);}}
 private static LocalDate today(){return LocalDate.now(ZoneId.of("Asia/Tokyo"));}
 private static String text(String s){return s==null?"":s;}
 private static void validate(int page,Long merchant,Long issue,String locale,String period,String query,String category,String version){
  if(page<0||page>100000||merchant!=null&&merchant<1||issue!=null&&issue<1||!Set.of("ja-JP","zh-CN","zh-TW","en-US").contains(locale)||!Set.of("all","current","history").contains(period)||query!=null&&query.length()>500||category!=null&&category.length()>255||version!=null&&!version.matches("[0-9a-f]{64}")||page>0&&version==null)throw new IllegalArgumentException("Invalid recommendation browse query");
 }
 static boolean expired(RecommendationService.Detail d,LocalDate day){
  var s=d.serviceOffer();if(s!=null)return s.applicationStart()!=null&&s.serviceStart()!=null&&s.applicationEnd()!=null&&s.serviceEnd()!=null&&!s.applicationStart().isAfter(s.applicationEnd())&&!s.serviceStart().isAfter(s.serviceEnd())&&day.isAfter(s.applicationEnd())&&day.isAfter(s.serviceEnd());
  return !d.items().isEmpty()&&d.items().stream().allMatch(i->{
   var c=i.referenceContext;boolean inherit=c!=null&&c.activityApplies()&&c.windowEvidence()!=null&&!c.windowEvidence().isBlank()&&c.sourceUrl()!=null&&c.sourceUrl().startsWith("https://");
   LocalDate start=i.offerStart!=null?i.offerStart:inherit?c.activityStart():null,end=i.offerEnd!=null?i.offerEnd:inherit?c.activityEnd():null;
   if(start==null||end==null||start.isAfter(end)||!day.isAfter(end))return false;
   return i.couponStart==null&&i.couponEnd==null||i.couponStart!=null&&i.couponEnd!=null&&!i.couponStart.isAfter(i.couponEnd)&&day.isAfter(i.couponEnd);
  });
 }
 private static String title(RecommendationService.Detail d,String locale){var t=d.articleTranslations().get(locale);return !locale.equals("ja-JP")&&"ja-JP".equals(d.articleSourceLocale())&&t!=null&&Objects.equals(t.sourceHash(),d.articleSourceHash())&&!text(t.title()).isBlank()?t.title():d.post().title();}
 private static String body(RecommendationService.Detail d,String locale){var t=d.articleTranslations().get(locale);return !locale.equals("ja-JP")&&"ja-JP".equals(d.articleSourceLocale())&&t!=null&&Objects.equals(t.sourceHash(),d.articleSourceHash())&&!text(t.body()).isBlank()?t.body():d.body();}
 private static boolean search(Row r,String needle,String locale){
  if(r.item()==null)return (text(title(r.detail(),locale))+" "+text(body(r.detail(),locale))+" "+r.detail().serviceOffer().provider()).toLowerCase(Locale.ROOT).contains(needle);
  var i=r.item();var t="REVIEWED".equals(i.getTranslationStatus())?i.translations.get(locale):null;
  String name=!locale.equals("ja-JP")&&t!=null&&!text(t.name()).isBlank()?t.name()+"\uff08"+text(i.name)+"\uff09":text(i.name);
  return (name+" "+text(i.itemNumber)).toLowerCase(Locale.ROOT).contains(needle);
 }
 private static List<String> ids(RecommendationItem i){return i.categoryIds==null?i.categories.stream().map(RecommendationItem.Label::id).distinct().toList():i.categoryIds.stream().distinct().toList();}
 private static boolean period(boolean history,String period){return period.equals("all")||history==period.equals("history");}
 /** Sort only an explicitly sourced issue date. Publication/edit timestamps are not issue dates. */
 static Comparator<Issue> issueOrder(){return Comparator.comparing(Issue::issueDate,Comparator.nullsLast(Comparator.reverseOrder()))
   .thenComparing(i->i.post().id(),Comparator.nullsLast(Comparator.reverseOrder()));}
 private static List<SupplierLabel> publicSuppliers(RecommendationService.Detail d){
  var found=new TreeMap<String,SupplierLabel>();
  for(var item:d.items()){
   if(!item.showSupplier||item.supplierId==null||item.supplierId.isBlank()||item.supplierName==null)continue;
   var names=new TreeMap<String,String>();item.supplierName.forEach((locale,name)->{if(locale!=null&&!locale.isBlank()&&name!=null&&!name.isBlank())names.put(locale,name);});
   if(!names.isEmpty())found.putIfAbsent(item.supplierId,new SupplierLabel(item.supplierId,Collections.unmodifiableMap(names)));
  }
  return List.copyOf(found.values());
 }
 private static Issue directoryIssue(RecommendationService.Detail d,LocalDate day,String query,String locale){
  // Public browse entries already apply the server's public-item projection; do not reintroduce private items here.
  return new Issue(d.post(),title(d,locale),expired(d,day),d.serviceOffer()!=null?1:d.items().stream().filter(i->search(new Row(d,i,expired(d,day)),query,locale)).count(),
    d.serviceOffer()!=null,d.items().size(),publicSuppliers(d),d.post().issueDate(),d.post().issueDateSource());
 }
 private static ItemCard card(RecommendationItem i,java.math.BigDecimal rating){var translations=new TreeMap<String,RecommendationItem.Text>();if("REVIEWED".equals(i.getTranslationStatus()))i.translations.forEach((k,t)->translations.put(k,new RecommendationItem.Text(t.name(),t.specification(),null,t.offerNotes())));
  return new ItemCard(i.id,i.productId,i.name,i.brand,i.itemNumber,i.specification,i.model,i.packaging,translations,i.getTranslationStatus(),i.categories,i.gallery.isEmpty()?null:i.gallery.get(0),i.referencePrice,i.originalPrice,i.discountAmount,i.priceUnit,"JPY",i.offerStart,i.offerEnd,i.couponStart,i.couponEnd,i.offerNotes,i.referenceContext,i.referenceQuote,rating);
 }
 @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
 public Directory directory(int page,Long merchant,String locale,String period,String query,String expected){
  validate(page,merchant,null,locale,period,query,"",expected);var day=today();var data=recommendations.publicBrowseEntries(merchant);String q=text(query).strip().toLowerCase(Locale.ROOT);
  var datasetVersion=revision(Arrays.asList("recommendation-data-v1",merchant,day,data,ratings(data)));var version=revision(Arrays.asList("recommendation-directory-v2",datasetVersion,locale,period,q));if(expected!=null&&!expected.equals(version))throw new PublicProductBrowseService.Changed();
  var scoped=data.stream().filter(d->period(expired(d,day),period)).filter(d->d.serviceOffer()!=null?search(new Row(d,null,expired(d,day)),q,locale):d.items().stream().anyMatch(i->search(new Row(d,i,expired(d,day)),q,locale))||q.isEmpty()).map(d->directoryIssue(d,day,q,locale)).sorted(issueOrder()).toList();
  int start=(int)Math.min((long)page*20,scoped.size()),end=Math.min(start+20,scoped.size());
  return new Directory(scoped.subList(start,end),page,20,scoped.size(),end<scoped.size(),version,day.toString(),datasetVersion);
 }
 @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
 public Page page(int page,Long merchant,Long issue,String locale,String period,String query,String category,String expected){
  return page(page,merchant,issue,locale,period,query,category,expected,"default");
 }
 @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
 public Page page(int page,Long merchant,Long issue,String locale,String period,String query,String category,String expected,String order){
  ProductBrowseOrder.validate(order);
  validate(page,merchant,issue,locale,period,query,category,expected);var now=Instant.now();var day=now.atZone(ZoneId.of("Asia/Tokyo")).toLocalDate();var data=recommendations.publicBrowseEntries(merchant);String q=text(query).strip().toLowerCase(Locale.ROOT),cat=text(category);
  var currentPrices=order.startsWith("price")&&prices!=null?prices.prices(data.stream().flatMap(d->d.items().stream()).map(i->i.productId).filter(Objects::nonNull).distinct().toList()):Map.<String,PublicBrowsePriceService.Price>of();
  String datasetVersion=revision(Arrays.asList("recommendation-data-v1",merchant,day,data,ratings(data)));String version=revision(Arrays.asList("recommendation-occurrences-v1",datasetVersion,issue,locale,period,q,cat,order,currentPrices,order.startsWith("heat")&&popularity!=null?popularity.counts():Map.of()));if(expected!=null&&!expected.equals(version))throw new PublicProductBrowseService.Changed();
  var scope=new ArrayList<Row>();for(var d:data){boolean history=expired(d,day);if(issue!=null&&!issue.equals(d.post().id())||!period(history,period))continue;if(d.serviceOffer()!=null){var r=new Row(d,null,history);if(search(r,q,locale))scope.add(r);}else for(var i:d.items()){var r=new Row(d,i,history);if(search(r,q,locale))scope.add(r);}}
  var labels=new LinkedHashMap<String,RecommendationItem.Label>();var counts=new LinkedHashMap<String,Long>();long unclassified=0,services=0;
  for(var r:scope){if(r.item()==null){services++;continue;}var ids=ids(r.item());if(ids.isEmpty())unclassified++;var seen=new HashSet<String>();for(var c:r.item().categories)if(ids.contains(c.id())&&seen.add(c.id())){labels.put(c.id(),c);counts.merge(c.id(),1L,Long::sum);}}
  var facets=counts.entrySet().stream().map(e->new PublicProductBrowseService.Facet(e.getKey(),labels.get(e.getKey()).name(),e.getValue())).toList();
  var filtered=scope.stream().filter(r->cat.isEmpty()||r.item()!=null&&(cat.equals("__unclassified")?ids(r.item()).isEmpty():ids(r.item()).contains(cat))).toList();
  var sortRatings=ratings(data);var heat=popularity==null?Map.<String,Long>of():popularity.counts();
  if(order.startsWith("price"))filtered=ProductBrowseOrder.prices(filtered,order,r->{if(r.item()==null)return null;var item=r.item();var actual=item.productId==null?null:currentPrices.get(item.productId);var display=ReferencePriceDisplay.of(item,now);return actual!=null?actual:display.amount()==null?null:new PublicBrowsePriceService.Price(display.amount(),"JPY");});
  else filtered=ProductBrowseOrder.sorted(filtered,order,r->null,r->r.item()==null||r.item().productId==null?null:sortRatings.get(r.item().productId),r->r.item()==null||r.item().productId==null?null:heat.getOrDefault(r.item().productId,0L));
  int start=(int)Math.min((long)page*24,filtered.size()),end=Math.min(start+24,filtered.size());
  var publicRatings=ratings(data);var rows=filtered.subList(start,end).stream().map(r->{var s=r.detail().serviceOffer();return new Occurrence(r.detail().post().id()+":"+(r.item()==null?"service":r.item().id),r.detail().post(),title(r.detail(),locale),r.history(),r.item()==null?null:card(r.item(),r.item().productId==null?null:publicRatings.get(r.item().productId)),r.item()==null,s==null?null:new ServiceCard(s.provider(),s.staff(),s.hours(),s.originalPrice(),s.price(),s.currency(),s.taxIncluded(),s.fees(),s.noExtraFees(),s.applicationStart(),s.applicationEnd(),s.serviceStart(),s.serviceEnd(),s.effectiveBasis(),s.packages()));}).toList();
  return new Page(rows,page,24,scope.size(),filtered.size(),scope.size()-services,services,end<filtered.size(),version,facets,unclassified,day.toString(),datasetVersion);
 }
}
