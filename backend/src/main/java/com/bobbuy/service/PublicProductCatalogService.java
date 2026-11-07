package com.bobbuy.service;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Browsing is independent of sale readiness and trip availability. No private/draft expansion. */
@Service
public class PublicProductCatalogService {
 private final ProductRepository products;private final RecommendationPostRepository posts;private final RecommendationItemRepository items;
 private final RecommendationTaxonomyService taxonomy;private final ReferenceQuoteService quotes;private final CategoryRepository categories;
 public PublicProductCatalogService(ProductRepository p,RecommendationPostRepository r,RecommendationItemRepository i,RecommendationTaxonomyService t,ReferenceQuoteService q,CategoryRepository c){products=p;posts=r;items=i;taxonomy=t;quotes=q;categories=c;}
 public record Offer(Long postId,RecommendationItem facts){}
 public record Entry(String productId,Long merchantId,Map<String,String> name,Map<String,String> description,String brand,String itemNumber,Map<String,String> specification,String model,String packaging,List<RecommendationItem.Picture> gallery,List<RecommendationItem.Label> categories,List<Offer> referenceOffers,boolean reviewedMaster){}
 public record Page(List<Entry> items,int page,int size,long total,boolean hasNext){}
 private record Snapshot(List<Product> eligible,Map<Long,Long> owners,Map<String,List<RecommendationItem>> linked){}
 private Snapshot snapshot(Long merchantId){
  var published=posts.findByPublishedTrue().stream().filter(p->merchantId==null||merchantId.equals(p.merchantId)).toList();
  Map<Long,Long> owners=new HashMap<>();published.forEach(p->owners.put(p.id,p.merchantId));
  var originals=published.isEmpty()?List.<RecommendationItem>of():items.findByPostIdInOrderById(published.stream().map(p->p.id).toList());
  var displayed=taxonomy.display(originals,true);
  var linked=new HashMap<String,List<RecommendationItem>>();for(var i:displayed)if(i.productId!=null)linked.computeIfAbsent(i.productId,k->new ArrayList<>()).add(i);
  var eligible=products.findAll().stream().filter(p->!p.isDeleted()).filter(p->merchantId==null||merchantId.equals(p.getMerchantId()))
   .filter(p->p.getVisibilityStatus()==ProductVisibility.PUBLIC||p.getVisibilityStatus()==ProductVisibility.DRAFTER_ONLY&&linked.getOrDefault(p.getId(),List.of()).stream().anyMatch(i->Objects.equals(owners.get(i.postId),p.getMerchantId())))
   .sorted(Comparator.comparing(Product::getId)).toList();
  return new Snapshot(eligible,owners,linked);
 }
 /** Marker reads share exactly the browsing predicate; this is not sale authorization. */
 @Transactional(readOnly=true)
 public Map<String,Long> visibleProductOwners(Long merchantId){
  if(merchantId!=null&&merchantId<1)throw new IllegalArgumentException("Invalid merchant");
  var result=new LinkedHashMap<String,Long>();snapshot(merchantId).eligible().forEach(p->result.put(p.getId(),p.getMerchantId()));return Collections.unmodifiableMap(result);
 }
 @Transactional(readOnly=true)
 public Page page(int page,Long merchantId){return page(page,merchantId,null);}
 @Transactional(readOnly=true)
 public Page page(int page,Long merchantId,Set<String> selectedProductIds){
  if(page<0||page>100000||merchantId!=null&&merchantId<1)throw new IllegalArgumentException("Invalid public catalog page");
  var rows=publicEntries(merchantId,selectedProductIds);
  int size=24,start=(int)Math.min((long)page*size,rows.size()),end=Math.min(start+size,rows.size());
  return new Page(rows.subList(start,end),page,size,rows.size(),end<rows.size());
 }
 /** Shared safe projection for server-side browse/search; never returns private master fallbacks. */
 @Transactional(readOnly=true)
 public List<Entry> publicEntries(Long merchantId,Set<String> selectedProductIds){
  if(merchantId!=null&&merchantId<1)throw new IllegalArgumentException("Invalid merchant");
  var snapshot=snapshot(merchantId);var owners=snapshot.owners();var linked=snapshot.linked();quotes.decorate(linked.values().stream().flatMap(List::stream).toList(),true);
  var eligible=selectedProductIds==null?snapshot.eligible():snapshot.eligible().stream().filter(p->selectedProductIds.contains(p.getId())).toList();
  return eligible.stream().map(p->{
   var offers=linked.getOrDefault(p.getId(),List.of()).stream().filter(i->Objects.equals(owners.get(i.postId),p.getMerchantId())).sorted(Comparator.comparing((RecommendationItem i)->i.postId).reversed().thenComparing(i->i.id)).map(i->new Offer(i.postId,i)).toList();
   var data=p.getCatalogData();var source=offers.isEmpty()?null:offers.get(0).facts();
   // A reference-only master grants no new disclosure: reuse exactly its existing public DTO.
   // In particular, an empty legacy gallery/brand must not fall back to private master fields.
   if(p.getVisibilityStatus()!=ProductVisibility.PUBLIC){
    return new Entry(p.getId(),p.getMerchantId(),Map.copyOf(legacyText(source,"name")),Map.copyOf(legacyText(source,"description")),source.brand,source.itemNumber,Map.copyOf(legacyText(source,"specification")),source.model,source.packaging,List.copyOf(source.gallery),List.copyOf(source.categories),offers,source.catalogDriven);
   }
   var ids=data==null?(p.getCategoryId()==null?List.<String>of():List.of(p.getCategoryId())):data.categoryIds()==null?List.<String>of():data.categoryIds();
   var labels=categories.findAllById(ids).stream().map(c->new RecommendationItem.Label(c.getId(),c.getName())).toList();
   List<RecommendationItem.Picture> gallery=source==null||source.gallery==null||source.gallery.isEmpty()?p.getMediaGallery().stream().filter(m->m.isVisible()&&m.getType()==MediaType.IMAGE&&m.getUrl()!=null).map(m->new RecommendationItem.Picture(UUID.nameUUIDFromBytes(m.getUrl().getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString(),m.getUrl(),null,m.getSourceUrl(),m.getUrl(),null,null)).toList():source.gallery;
   // Reviewed masters own metadata. Legacy public sources remain unchanged, never guessed/split.
   Map<String,String> names=p.getName(),descriptions=p.getDescription(),spec=data==null?Map.of():data.specification();String brand=p.getBrand(),model=data==null?null:data.model(),pack=data==null?null:data.packaging();
   if(data==null&&source!=null){names=legacyText(source,"name");descriptions=legacyText(source,"description");spec=legacyText(source,"specification");if(brand==null||brand.isBlank())brand=source.brand;model=source.model;pack=source.packaging;}
   else if(data!=null&&!ProductCatalogService.translationsCurrent(p)){names=sourceOnly(names);descriptions=sourceOnly(descriptions);spec=sourceOnly(spec);}
   return new Entry(p.getId(),p.getMerchantId(),Map.copyOf(names),Map.copyOf(descriptions),brand,p.getItemNumber(),Map.copyOf(spec),model,pack,List.copyOf(gallery),labels,offers,data!=null);
  }).toList();
 }
 private static Map<String,String> sourceOnly(Map<String,String> input){return input.get("ja-JP")==null?Map.of():Map.of("ja-JP",input.get("ja-JP"));}
 private static Map<String,String> legacyText(RecommendationItem i,String field){var result=new HashMap<String,String>();String original=field.equals("name")?i.name:field.equals("description")?i.description:i.specification;if(original!=null&&!original.isBlank())result.put("ja-JP",original);if("REVIEWED".equals(i.getTranslationStatus()))for(var e:i.translations.entrySet()){String value=field.equals("name")?e.getValue().name():field.equals("description")?e.getValue().description():e.getValue().specification();if(value!=null&&!value.isBlank())result.put(e.getKey(),value);}return result;}
}
