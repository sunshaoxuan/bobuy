package com.bobbuy.service;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.security.MerchantScope;
import com.bobbuy.api.response.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Informational badges only. Never changes stock, prices, carts, orders or checkout eligibility. */
@Service
public class ProductMarkerService {
 private final ProductMarkerDefinitionRepository definitions;private final ProductMarkerSetRepository sets;private final ProductRepository products;private final UserRepository users;private final PublicProductCatalogService catalog;
 private static final Set<String> LOCALES=Set.of("ja-JP","zh-CN","zh-TW","en-US"),COLORS=Set.of("red","orange","gold","green","blue","purple","gray");
 public ProductMarkerService(ProductMarkerDefinitionRepository d,ProductMarkerSetRepository s,ProductRepository p,UserRepository u,PublicProductCatalogService c){definitions=d;sets=s;products=p;users=u;catalog=c;}
 public record Definition(String id,String code,String badge,Map<String,String> name,Map<String,String> description,String color,int sortOrder,boolean enabled,long version){}
 public record Input(String code,String badge,Map<String,String> name,Map<String,String> description,String color,int sortOrder,boolean enabled,Long version){}
 public record Assignment(String productId,List<String> markerIds,long version){}
 public record PublicAssignment(String productId,List<Definition> markers){}
 private ApiException invalid(){return new ApiException(ErrorCode.INVALID_REQUEST,"error.marker.invalid");}
 private ApiException absent(){return new ApiException(ErrorCode.RESOURCE_NOT_FOUND,"error.product.not_found");}
 private Long owner(){var id=MerchantScope.current();if(id==null)throw new ApiException(ErrorCode.FORBIDDEN,"error.auth.forbidden");return id;}
 private Long lockOwner(){Long id=owner();users.lockById(id).orElseThrow(this::absent);return id;}
 private Product owned(String id,Long owner){return products.findById(id).filter(p->owner.equals(p.getMerchantId())&&!p.isDeleted()).orElseThrow(this::absent);}
 private Definition view(ProductMarkerDefinition d){return new Definition(d.id,d.code,d.badge,Map.copyOf(d.name),Map.copyOf(d.description),d.color,d.sortOrder,d.enabled,Objects.requireNonNullElse(d.version,0L));}
 private static Comparator<ProductMarkerDefinition> ordering(){return Comparator.comparingInt((ProductMarkerDefinition d)->d.sortOrder).thenComparing(d->d.id);}
 private void validate(Input i){
  if(i==null||i.code()==null||!i.code().matches("[a-z][a-z0-9_-]{0,39}")||i.badge()==null||i.badge().codePointCount(0,i.badge().length())!=1||i.badge().codePoints().anyMatch(c->Character.isISOControl(c)||Character.isWhitespace(c)||"<>&\"'".indexOf(c)>=0)||i.color()==null||!COLORS.contains(i.color())||i.sortOrder()<0||i.sortOrder()>10000)throw invalid();
  if(i.name()==null||!i.name().keySet().equals(LOCALES)||i.name().values().stream().anyMatch(v->v==null||v.isBlank()||v.length()>80))throw invalid();
  if(i.description()!=null&&(!LOCALES.containsAll(i.description().keySet())||i.description().values().stream().anyMatch(v->v==null||v.length()>1000)))throw invalid();
 }
 @Transactional(readOnly=true) public List<Definition> definitions(){return definitions.findByMerchantIdOrderBySortOrderAscIdAsc(owner()).stream().map(this::view).toList();}
 @Transactional public Definition save(String id,Input i){
  validate(i);Long owner=lockOwner();ProductMarkerDefinition d;
  if(id==null){if(i.version()!=null||definitions.findByMerchantIdAndCode(owner,i.code()).isPresent())throw invalid();d=new ProductMarkerDefinition();d.id=UUID.randomUUID().toString();d.merchantId=owner;d.code=i.code();}
  else{d=definitions.findById(id).filter(v->owner.equals(v.merchantId)).orElseThrow(this::absent);if(!Objects.equals(d.version,i.version())||!d.code.equals(i.code()))throw invalid();}
  d.badge=i.badge();d.name=new HashMap<>(i.name());d.description=new HashMap<>(Objects.requireNonNullElse(i.description(),Map.of()));d.color=i.color();d.sortOrder=i.sortOrder();d.enabled=i.enabled();return view(definitions.saveAndFlush(d));
 }
 @Transactional(readOnly=true) public Assignment assignment(String id){Long owner=owner();owned(id,owner);return assignment(id,owner);}
 private Assignment assignment(String id,Long owner){return sets.findById(id).filter(s->owner.equals(s.merchantId)).map(s->new Assignment(id,List.copyOf(s.markerIds),Objects.requireNonNullElse(s.version,0L)+1)).orElse(new Assignment(id,List.of(),0));}
 @Transactional public Assignment assign(String id,List<String> ids,long version){
  Long owner=lockOwner();owned(id,owner);if(version<0||ids==null||ids.size()>50||ids.stream().anyMatch(Objects::isNull)||new HashSet<>(ids).size()!=ids.size())throw invalid();
  var selected=definitions.findAllById(ids);if(selected.size()!=ids.size()||selected.stream().anyMatch(d->!owner.equals(d.merchantId)))throw invalid();
  var normalized=selected.stream().sorted(ordering()).map(d->d.id).toList();var existing=sets.findById(id);if(existing.isPresent()&&!owner.equals(existing.get().merchantId))throw absent();
  var current=assignment(id,owner);if(!Objects.equals(new HashSet<>(current.markerIds()),new HashSet<>(normalized))&&current.version()!=version)throw invalid();
  // Same requested set is a true no-op, including retries after an uncertain response.
  if(new HashSet<>(current.markerIds()).equals(new HashSet<>(normalized)))return current;
  var set=existing.orElseGet(ProductMarkerSet::new);set.productId=id;set.merchantId=owner;set.markerIds=new ArrayList<>(normalized);return new Assignment(id,List.copyOf(normalized),Objects.requireNonNullElse(sets.saveAndFlush(set).version,0L)+1);
 }
 @Transactional(readOnly=true) public List<PublicAssignment> publicAssignments(List<String> ids){
  if(ids==null||ids.isEmpty()||ids.size()>100||ids.stream().anyMatch(Objects::isNull)||new HashSet<>(ids).size()!=ids.size())throw invalid();
  return publicAssignments(ids,catalog.visibleProductOwners(null));
 }
 private List<PublicAssignment> publicAssignments(List<String> ids,Map<String,Long> owners){
  var visible=new LinkedHashMap<String,Long>();ids.stream().filter(owners::containsKey).forEach(id->visible.put(id,owners.get(id)));
  var assignments=sets.findAllById(visible.keySet());var allIds=assignments.stream().flatMap(s->s.markerIds.stream()).distinct().toList();var definitionMap=new HashMap<String,ProductMarkerDefinition>();definitions.findAllById(allIds).forEach(d->definitionMap.put(d.id,d));
  var assignmentMap=new HashMap<String,ProductMarkerSet>();assignments.forEach(a->assignmentMap.put(a.productId,a));
  return ids.stream().filter(visible::containsKey).map(id->{var set=assignmentMap.get(id);var productOwner=visible.get(id);var markers=set==null||!Objects.equals(set.merchantId,productOwner)?List.<Definition>of():set.markerIds.stream().map(definitionMap::get).filter(Objects::nonNull).filter(d->d.enabled&&Objects.equals(d.merchantId,productOwner)).sorted(ordering()).map(this::view).toList();return new PublicAssignment(id,markers);}).toList();
 }
 /** Internal public browse projection uses already-qualified owners in the same read snapshot. */
 @Transactional(readOnly=true) public List<PublicAssignment> browseAssignments(Map<String,Long> owners){
  return publicAssignments(List.copyOf(owners.keySet()),owners);
 }
 @Transactional(readOnly=true) public Set<String> markedProductIds(Long merchantId){
  var owners=catalog.visibleProductOwners(merchantId);var all=List.copyOf(owners.keySet());var result=new HashSet<String>();for(int start=0;start<all.size();start+=100)publicAssignments(all.subList(start,Math.min(start+100,all.size())),owners).stream().filter(a->!a.markers().isEmpty()).forEach(a->result.add(a.productId()));return Set.copyOf(result);
 }
 @Transactional public List<Definition> defaults(){Long owner=lockOwner();String[][] values={{"new","新","green","新商品","新品","新商品","New product"},{"discount","折","red","割引","优惠","優惠","Discount"},{"low","少","orange","残りわずか","余量较少","餘量較少","Low quantity"},{"missing","缺","gray","品切れ","已缺货","已缺貨","Out of stock"}};for(int index=0;index<values.length;index++){var v=values[index];if(definitions.findByMerchantIdAndCode(owner,v[0]).isEmpty()){var d=new ProductMarkerDefinition();d.id=UUID.randomUUID().toString();d.merchantId=owner;d.code=v[0];d.badge=v[1];d.color=v[2];d.name=Map.of("ja-JP",v[3],"zh-CN",v[4],"zh-TW",v[5],"en-US",v[6]);d.sortOrder=index*10;d.enabled=true;definitions.saveAndFlush(d);}}return definitions();}
}
