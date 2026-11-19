package com.bobbuy.service;

import com.bobbuy.model.RecommendationItem;
import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import java.security.MessageDigest;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/** Stateless public read contract. Counts and rows come from one repeatable-read snapshot.
 * No TTL cache: public publication/translation/marker changes are visible on the next read.
 */
@Service
public class PublicProductBrowseService {
 private final PublicProductCatalogService catalog;
 private ShoppingCategoryService shopping;
 @org.springframework.beans.factory.annotation.Autowired public void setShopping(ShoppingCategoryService shopping){this.shopping=shopping;}
 private final ProductMarkerService markers;
 private final ObjectMapper json=new ObjectMapper().findAndRegisterModules()
   .configure(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS,true)
   .configure(MapperFeature.SORT_PROPERTIES_ALPHABETICALLY,true);
 private final ProductPopularityService popularity;private final PublicBrowsePriceService prices;
 public PublicProductBrowseService(PublicProductCatalogService c,ProductMarkerService m){this(c,m,null,null);}
 @org.springframework.beans.factory.annotation.Autowired public PublicProductBrowseService(PublicProductCatalogService c,ProductMarkerService m,ProductPopularityService popularity,PublicBrowsePriceService prices){catalog=c;markers=m;this.popularity=popularity;this.prices=prices;}
 public record Facet(String id,Map<String,String> name,long count,String parentId,String icon,String imageUrl){public Facet(String id,Map<String,String> name,long count){this(id,name,count,null,null,null);}public Facet(String id,Map<String,String> name,long count,String parentId,String icon){this(id,name,count,parentId,icon,null);}}
 public record Shelf(String category,List<Card> items,long total){}
 public record CardReference(java.math.BigDecimal amount,String currency,String unit,Long postId,Long itemId,String state,java.math.BigDecimal originalPrice,java.math.BigDecimal discountAmount,RecommendationItem.PriceChange priceChange){}
 public record Card(String productId,Long merchantId,Map<String,String> name,String brand,String itemNumber,
   Map<String,String> specification,String model,String packaging,RecommendationItem.Picture image,
   List<RecommendationItem.Label> categories,List<ProductMarkerService.Definition> markers,boolean reviewedMaster,java.math.BigDecimal rating,CardReference reference){}
 private static CardReference reference(PublicProductCatalogService.Entry entry,java.time.Instant now){
  if(!entry.referencePrices().isEmpty()){var p=entry.referencePrices().get(0);return new CardReference(p.amount(),p.currency(),p.unit(),null,null,p.state(),p.promotion()?p.regularAmount():null,p.promotion()?p.regularAmount().subtract(p.amount()):null,new RecommendationItem.PriceChange(p.documentId(),p.documentNumber(),p.type(),p.state(),p.startsAt(),p.endsAt(),p.amount(),p.regularAmount(),p.amount(),p.promotion()));}
  return ReferencePriceDisplay.main(entry).map(offer->{var facts=offer.facts();var display=ReferencePriceDisplay.of(facts,now);return display.amount()==null?null:new CardReference(display.amount(),"JPY",facts.priceUnit,offer.postId(),facts.id,display.state(),display.originalPrice(),display.discountAmount(),facts.priceChange);}).orElse(null);
 }
 public record Browse(List<Card> items,int page,int size,long scopeTotal,long matchedTotal,boolean hasNext,
   String revision,List<Facet> categories,long unclassified,String query,String category,String locale,String dataset,String datasetRevision,long markedScopeTotal,List<Shelf> shelves,String selectedCategory){}
 public record Detail(PublicProductCatalogService.Entry item,List<ProductMarkerService.Definition> markers,String revision){}
 public static final class Changed extends RuntimeException { public Changed(){super("Public browse changed; restart at page 0");} }
 public static final class Missing extends RuntimeException {}
 private record Dataset(List<PublicProductCatalogService.Entry> entries,Map<String,List<ProductMarkerService.Definition>> markers){}
 private Dataset dataset(Long merchant){
  var entries=catalog.publicEntries(merchant,null);var owners=new LinkedHashMap<String,Long>();
  entries.forEach(e->owners.put(e.productId(),e.merchantId()));
  var byId=new TreeMap<String,List<ProductMarkerService.Definition>>();
  markers.browseAssignments(owners).forEach(a->byId.put(a.productId(),a.markers()));
  return new Dataset(entries,byId);
 }
 private String revision(Object value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(json.writeValueAsBytes(value)));}catch(Exception e){throw new IllegalStateException("Cannot version public projection",e);}}
 private static String text(String value){return value==null?"":value;}
 private static boolean matches(PublicProductCatalogService.Entry e,String needle){
  var fields=new ArrayList<String>(List.of(e.productId(),text(e.itemNumber()),text(e.brand()),text(e.model()),text(e.packaging())));
  fields.addAll(e.name().values());fields.addAll(e.specification().values());fields.addAll(e.description().values());
  e.categories().forEach(c->fields.addAll(c.name().values()));
  return String.join(" ",fields).toLowerCase(Locale.ROOT).contains(needle);
 }
 private static void validate(int page,Long merchant,String query,String category,String locale,String revision){
  if(page<0||page>100000||merchant!=null&&merchant<1||query!=null&&query.length()>500||category!=null&&category.length()>255
    ||!Set.of("ja-JP","zh-CN","zh-TW","en-US").contains(locale)||revision!=null&&!revision.matches("[0-9a-f]{64}"))throw new IllegalArgumentException("Invalid browse query");
  if(page>0&&revision==null)throw new IllegalArgumentException("Continuation requires revision");
 }
 @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
 public Browse browse(int page,Long merchant,String query,String category,String locale,boolean marked,String expected){
  return browse(page,merchant,query,category,locale,marked,expected,"default",true);
 }
 @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
 public Browse browse(int page,Long merchant,String query,String category,String locale,boolean marked,String expected,String order){ return browse(page,merchant,query,category,locale,marked,expected,order,true); }
 @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
 public Browse browse(int page,Long merchant,String query,String category,String locale,boolean marked,String expected,String order,boolean markedFirst){
  return project(page,merchant,query,category,locale,marked,expected,order,markedFirst,null);
 }
 /** Navigation with its first bounded shelf, and subsequent bounded shelves use the exact same public projection and revision as browse.
  * No cache or private-master fallback: publication changes invalidate subsequent shelf reads. */
 @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
 public Browse overview(Long merchant,String locale,boolean markedFirst){
  return project(0,merchant,"","",locale,false,null,"default",markedFirst,"");
 }
 @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
 public Browse shelf(Long merchant,String locale,boolean markedFirst,String category,String expected){
  if(category==null||category.isBlank()||category.length()>255||expected==null)throw new IllegalArgumentException("Shelf requires category and revision");
  return project(0,merchant,"","",locale,false,expected,"default",markedFirst,category);
 }
 private Browse project(int page,Long merchant,String query,String category,String locale,boolean marked,String expected,String order,boolean markedFirst,String shelfOnly){
  ProductBrowseOrder.validate(order);
  validate(page,merchant,query,category,locale,expected);String q=text(query).strip().toLowerCase(Locale.ROOT),cat=text(category);
  var now=java.time.Instant.now();var data=dataset(merchant);String dataset=marked?"marked":"all";
  var shoppingData=shopping==null?null:shopping.snapshot(data.entries().stream().map(e->e.productId()).toList());
  String datasetVersion=revision(Arrays.asList("public-product-data-v1",merchant,now.atZone(java.time.ZoneId.of("Asia/Tokyo")).toLocalDate(),data,shoppingData));
  var currentPrices=order.startsWith("price")&&prices!=null?prices.prices(data.entries().stream().map(e->e.productId()).toList()):Map.<String,PublicBrowsePriceService.Price>of();
  String version=revision(Arrays.asList("public-product-browse-v1",datasetVersion,q,cat,locale,dataset,order,markedFirst,currentPrices,order.startsWith("heat")&&popularity!=null?popularity.counts():Map.of()));
  if(expected!=null&&!expected.equals(version))throw new Changed();
  var scope=data.entries().stream().filter(e->!marked||!data.markers().getOrDefault(e.productId(),List.of()).isEmpty()).filter(e->matches(e,q)).toList();
  var labels=new LinkedHashMap<String,RecommendationItem.Label>();var counts=new LinkedHashMap<String,Long>();long unclassified=0;
  Map<String,String> assignments=shoppingData==null?Map.of():shoppingData.assignments();
  var display=shoppingData==null?List.<ShoppingCategoryMap.Category>of():shoppingData.categories();
  var parents=new HashMap<String,String>();display.forEach(c->{if(c.parentId()!=null)parents.put(c.id(),c.parentId());});
  for(var entry:scope){
   if(shoppingData==null){if(entry.categories().isEmpty())unclassified++;var seen=new HashSet<String>();for(var c:entry.categories())if(seen.add(c.id())){labels.put(c.id(),c);counts.merge(c.id(),1L,Long::sum);}}
   else {String leaf=assignments.get(entry.productId());if(leaf==null)unclassified++;else{counts.merge(leaf,1L,Long::sum);if(parents.get(leaf)!=null)counts.merge(parents.get(leaf),1L,Long::sum);}}
  }
  var facets=shoppingData==null?counts.entrySet().stream().map(e->new Facet(e.getKey(),labels.get(e.getKey()).name(),e.getValue())).toList():display.stream().filter(c->counts.getOrDefault(c.id(),0L)>0).map(c->new Facet(c.id(),c.name(),counts.get(c.id()),c.parentId(),c.icon(),c.imageUrl())).toList();
  // Obsolete raw-category links return to the overview; never interpret a source ID as a shopping ID.
  final String selected=shoppingData!=null&&!cat.equals("__unclassified")&&display.stream().noneMatch(c->c.id().equals(cat))?"":cat;
  var filtered=scope.stream().filter(e->{if(selected.isEmpty())return true;if(shoppingData==null)return selected.equals("__unclassified")&&e.categories().isEmpty()||e.categories().stream().anyMatch(c->c.id().equals(selected));String leaf=assignments.get(e.productId());return selected.equals("__unclassified")?leaf==null:selected.equals(leaf)||selected.equals(parents.get(leaf));}).toList();
  var heat=popularity==null?Map.<String,Long>of():popularity.counts();
  filtered=ProductBrowseOrder.sorted(filtered,order,e->reference(e,now)==null?null:reference(e,now).amount(),e->e.rating(),e->heat.getOrDefault(e.productId(),0L));
  if(order.startsWith("price"))filtered=ProductBrowseOrder.prices(filtered,order,e->{var actual=currentPrices.get(e.productId());var ref=reference(e,now);return actual!=null?actual:ref==null?null:new PublicBrowsePriceService.Price(ref.amount(),ref.currency());});
  if(markedFirst&&!marked)filtered=filtered.stream().sorted(Comparator.comparing((PublicProductCatalogService.Entry e)->data.markers().getOrDefault(e.productId(),List.of()).isEmpty())).toList();
  int start=(int)Math.min((long)page*24,filtered.size()),end=Math.min(start+24,filtered.size());
  java.util.function.Function<PublicProductCatalogService.Entry,Card> card=e->new Card(e.productId(),e.merchantId(),e.name(),e.brand(),e.itemNumber(),e.specification(),e.model(),e.packaging(),e.gallery().isEmpty()?null:e.gallery().get(0),shoppingData==null?e.categories():display.stream().filter(c->c.id().equals(assignments.get(e.productId()))).map(c->new RecommendationItem.Label(c.id(),c.name())).toList(),data.markers().getOrDefault(e.productId(),List.of()),e.reviewedMaster(),e.rating(),reference(e,now));
  var cards=shelfOnly==null?filtered.subList(start,end).stream().map(card).toList():List.<Card>of();
  var shelves=new ArrayList<Shelf>();
  if(shoppingData!=null&&!selected.equals("__unclassified")&&!parents.containsKey(selected)
      &&(selected.isEmpty()||filtered.stream().noneMatch(e->selected.equals(assignments.get(e.productId()))))){
   for(var facet:facets)if(Objects.equals(facet.parentId(),selected.isEmpty()?null:selected)){var shelfRows=filtered.stream().filter(e->{var leaf=assignments.get(e.productId());return facet.id().equals(leaf)||facet.id().equals(parents.get(leaf));}).toList();if(!shelfRows.isEmpty())shelves.add(new Shelf(facet.id(),shelfOnly==null||facet.id().equals(shelfOnly)||shelfOnly.isEmpty()&&shelves.isEmpty()?shelfRows.stream().limit(8).map(card).toList():List.of(),shelfRows.size()));}
   if(selected.isEmpty()&&unclassified>0){var rows=filtered.stream().filter(e->!assignments.containsKey(e.productId())).toList();shelves.add(new Shelf("__unclassified",shelfOnly==null||"__unclassified".equals(shelfOnly)||shelfOnly.isEmpty()&&shelves.isEmpty()?rows.stream().limit(8).map(card).toList():List.of(),rows.size()));}
  }
  if(shelfOnly!=null&&!shelfOnly.isEmpty()){
   shelves.removeIf(s->!s.category().equals(shelfOnly));
   if(shelves.isEmpty())throw new IllegalArgumentException("Unknown overview shelf");
  }
  long markedScopeTotal=data.entries().stream().filter(e->!data.markers().getOrDefault(e.productId(),List.of()).isEmpty()).count();
  return new Browse(cards,page,24,scope.size(),filtered.size(),end<filtered.size(),version,facets,unclassified,q,cat,locale,dataset,datasetVersion,markedScopeTotal,List.copyOf(shelves),selected);
 }
 @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
 public Detail detail(String id,Long merchant){
  if(id==null||id.isBlank()||id.length()>255||merchant!=null&&merchant<1)throw new IllegalArgumentException("Invalid detail query");
  var data=dataset(merchant);var item=data.entries().stream().filter(e->id.equals(e.productId())).findFirst().orElseThrow(Missing::new);
  return new Detail(item,data.markers().getOrDefault(id,List.of()),revision(Arrays.asList("public-product-detail-v1",merchant,item,data.markers().get(id))));
 }
}
