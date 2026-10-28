package com.bobbuy.service;

import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.security.MerchantScope;
import com.bobbuy.api.response.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import java.time.Instant;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@Service
public class ProductCatalogService {
 private final ProductRepository products;private final RecommendationItemRepository items;
 private final RecommendationImageRepository images;private final RecommendationPostRepository posts;
 private final UserRepository users;private final RecommendationTaxonomyService taxonomy;
 private final MediaBinaryService binaries;
 public ProductCatalogService(ProductRepository products,RecommendationItemRepository items,RecommendationImageRepository images,
  RecommendationPostRepository posts,UserRepository users,RecommendationTaxonomyService taxonomy,MediaBinaryService binaries){this.products=products;this.items=items;this.images=images;this.posts=posts;this.users=users;this.taxonomy=taxonomy;this.binaries=binaries;}
 public record Input(String productId,long version,Map<String,String> name,Map<String,String> description,String itemNumber,String brand,
  Map<String,String> specification,String model,String packaging,List<String> categoryIds,String supplierId,List<MediaGalleryItem> gallery,boolean translationsReviewed) {}
 public record Profile(Input value,boolean canonical,List<Long> sourceItemIds) {}
 public record Proposal(Input value,List<String> changes,List<String> warnings) {}
 private static ApiException invalid(String key){return new ApiException(ErrorCode.INVALID_REQUEST,key);}
 private Long owner(){var id=MerchantScope.current();if(id==null)throw new ApiException(ErrorCode.FORBIDDEN,"error.auth.forbidden");return id;}
 private Product owned(String id,boolean lock){return (lock?products.lockById(id):products.findById(id)).filter(p->owner().equals(p.getMerchantId())).orElseThrow(()->new ApiException(ErrorCode.RESOURCE_NOT_FOUND,"error.product.not_found"));}
 private List<RecommendationItem> sources(String id){Long owner=owner();return items.findByProductIdInOrderById(List.of(id)).stream().filter(i->posts.findById(i.postId).map(p->owner.equals(p.merchantId)).orElse(false)).toList();}
 public static String text(Map<String,String> values,String locale){return values==null?"":Objects.toString(values.get(locale),"");}
 public static String sourceHash(Product product){var data=product.getCatalogData();return hash(List.of(text(product.getName(),"ja-JP"),text(product.getDescription(),"ja-JP"),data==null?"":text(data.specification(),"ja-JP"),data==null?"":Objects.toString(data.model(),""),data==null?"":Objects.toString(data.packaging(),"")));}
 private static String hash(Object value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsBytes(value)));}catch(Exception error){throw new IllegalStateException(error);}}
 public static boolean translationsCurrent(Product product){return product.getCatalogData()!=null&&sourceHash(product).equals(product.getCatalogData().translatedSource());}
 private Input input(Product product){var data=product.getCatalogData();return new Input(product.getId(),Objects.requireNonNullElse(product.getRecordVersion(),0L),Map.copyOf(product.getName()),Map.copyOf(product.getDescription()),product.getItemNumber(),product.getBrand(),data==null?Map.of():data.specification(),data==null?null:data.model(),data==null?null:data.packaging(),data==null?(product.getCategoryId()==null?List.of():List.of(product.getCategoryId())):data.categoryIds(),data==null?null:data.supplierId(),List.copyOf(product.getMediaGallery()),translationsCurrent(product));}
 @Transactional(readOnly=true) public Profile get(String id){var p=owned(id,false);return new Profile(input(p),p.getCatalogData()!=null,sources(id).stream().map(i->i.id).toList());}
 @Transactional(readOnly=true) public List<Proposal> proposals(){return products.findAll().stream().filter(p->owner().equals(p.getMerchantId())).sorted(Comparator.comparing(Product::getId)).map(this::propose).toList();}
 private Proposal propose(Product product){
  var current=input(product);var source=sources(product.getId());var changes=new ArrayList<String>();var warnings=new ArrayList<String>();
  var preferred=source.stream().filter(i->i.postId.toString().equals(product.getAttributes().get("recommendationSourceIssue"))).findFirst().orElse(source.isEmpty()?null:source.get(0));
  if(preferred==null)return new Proposal(current,List.of(),List.of("master.no_source"));
  var names=new HashMap<>(current.name());var descriptions=new HashMap<>(current.description());var specifications=new HashMap<String,String>(current.specification());
  names.putIfAbsent("ja-JP",preferred.name);if(preferred.specification!=null)specifications.putIfAbsent("ja-JP",preferred.specification);
  if(preferred.description!=null&&text(descriptions,"ja-JP").isBlank())descriptions.put("ja-JP",preferred.description);
  boolean reviewed="REVIEWED".equals(preferred.getTranslationStatus());
  if(reviewed)for(var entry:preferred.translations.entrySet()){
   String locale=entry.getKey();var translated=entry.getValue();String existing=text(names,locale),pure=Objects.toString(translated.name(),"");
   if(existing.isBlank()||existing.equals(pure+"（"+preferred.name+"）"))names.put(locale,pure);
   else if(!existing.equals(pure))warnings.add("master.name_conflict:"+locale);
   if(translated.specification()!=null)specifications.putIfAbsent(locale,translated.specification());
   if(text(descriptions,locale).isBlank()&&translated.description()!=null)descriptions.put(locale,translated.description());
  }
  var gallery=new ArrayList<MediaGalleryItem>();var original=current.gallery();
  if(original.isEmpty())for(var picture:preferred.gallery)gallery.add(media(picture));
  else for(var originalMedia:original){var match=source.stream().flatMap(i->i.gallery.stream()).filter(p->p.url().equals(originalMedia.getUrl())).findFirst();
   // Keep existing media/order; supplement provenance only for the exact URL.
   if((originalMedia.getSourceUrl()==null||originalMedia.getSourceUrl().isBlank())&&match.isPresent())gallery.add(media(match.get()));else gallery.add(originalMedia);
  }
  if(source.stream().anyMatch(i->!Objects.equals(i.specification,preferred.specification)||!i.categoryIds.equals(preferred.categoryIds)))warnings.add("master.source_conflict");
  var categories=current.categoryIds().isEmpty()?preferred.categoryIds:current.categoryIds();
  String supplier=current.supplierId()==null?preferred.supplierId:current.supplierId();
  var candidate=new Input(current.productId(),current.version(),names,descriptions,current.itemNumber()==null?preferred.itemNumber:current.itemNumber(),current.brand(),specifications,current.model(),current.packaging(),categories,supplier,gallery,reviewed||current.translationsReviewed());
  if(!names.equals(current.name()))changes.add("master.names");if(!descriptions.equals(current.description()))changes.add("master.descriptions");
  if(!specifications.equals(current.specification()))changes.add("master.specifications");if(!categories.equals(current.categoryIds()))changes.add("master.categories");if(!Objects.equals(supplier,current.supplierId()))changes.add("master.supplier");
  var mapper=new com.fasterxml.jackson.databind.ObjectMapper();
  if(!mapper.valueToTree(gallery).equals(mapper.valueToTree(current.gallery())))changes.add("master.provenance");
  if(product.getCatalogData()==null)changes.add("master.canonical_save");return new Proposal(candidate,changes,warnings);
 }
 public static MediaGalleryItem media(RecommendationItem.Picture p){var media=new MediaGalleryItem(p.url(),MediaType.IMAGE,Map.of("ja-JP",Objects.toString(p.label(),"")),true,p.sourceUrl(),java.net.URI.create(p.sourceUrl()).getHost(),"OFFICIAL_PRODUCT");media.setSha256(p.hash());return media;}
 private static Map<String,String> clean(Map<String,String> values,int limit){
  if(values==null||values.size()>4||!Set.of("ja-JP","zh-CN","zh-TW","en-US").containsAll(values.keySet()))throw invalid("master.invalid");
  var result=new HashMap<String,String>();for(var entry:values.entrySet()){if(entry.getValue()==null||entry.getValue().length()>limit)throw invalid("master.invalid");if(!entry.getValue().isBlank())result.put(entry.getKey(),entry.getValue().trim());}return result;
 }
 private void validate(Input value,Product product){
  if(value==null||value.categoryIds()==null||value.categoryIds().size()>32||new HashSet<>(value.categoryIds()).size()!=value.categoryIds().size()||value.gallery()==null||value.gallery().size()>100)throw invalid("master.invalid");
  var names=clean(value.name(),400);clean(value.description(),8000);clean(value.specification(),1000);
  String ja=text(names,"ja-JP");if(ja.isBlank())throw invalid("master.japanese_required");
  if(names.entrySet().stream().anyMatch(e->!e.getKey().equals("ja-JP")&&e.getValue().endsWith("（"+ja+"）")))throw invalid("master.pure_name");
  if((value.itemNumber()!=null&&value.itemNumber().length()>100)||(value.brand()!=null&&value.brand().length()>200)||(value.model()!=null&&value.model().length()>300)||(value.packaging()!=null&&value.packaging().length()>1000))throw invalid("master.invalid");
  taxonomy.validate(value.categoryIds(),value.supplierId(),false);var urls=new HashSet<String>();
  for(var picture:value.gallery()){
   if(picture==null||picture.getType()!=MediaType.IMAGE||!urls.add(picture.getUrl()))throw invalid("gallery.invalid");
   try{var uri=java.net.URI.create(picture.getSourceUrl());if(!"https".equals(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null||uri.getRawQuery()!=null||uri.getRawFragment()!=null||picture.getSourceUrl().length()>2048)throw new IllegalArgumentException();}catch(Exception e){throw invalid("master.image_source");}
   boolean existing=product.getMediaGallery().stream().anyMatch(p->Objects.equals(p.getUrl(),picture.getUrl()));
   if(!existing){String prefix="/api/storefront/recommendation-images/";if(picture.getUrl()==null||!picture.getUrl().startsWith(prefix)||!images.findById(picture.getUrl().substring(prefix.length())).filter(i->owner().equals(i.merchantId)).isPresent())throw invalid("gallery.invalid");}
  }
 }
 @Transactional(readOnly=true) public List<Proposal> preview(List<Input> values){if(values==null||values.isEmpty()||values.size()>500)throw invalid("master.invalid");var ids=new HashSet<String>();return values.stream().map(value->{if(value==null||value.productId()==null||value.productId().isBlank()||!ids.add(value.productId()))throw invalid("master.invalid");var p=owned(value.productId(),false);if(!Objects.equals(p.getRecordVersion(),value.version()))throw invalid("master.conflict");validate(value,p);return new Proposal(value,List.of("master.canonical_save"),List.of());}).toList();}
 @Transactional public List<Profile> save(List<Input> values,boolean reviewed){
  if(!reviewed)throw invalid("master.review_required");users.lockById(owner()).orElseThrow();preview(values);
  var result=new ArrayList<Profile>();for(var value:values.stream().sorted(Comparator.comparing(Input::productId)).toList()){
   var p=owned(value.productId(),true);if(!Objects.equals(p.getRecordVersion(),value.version()))throw invalid("master.conflict");
   p.setName(clean(value.name(),400));p.setDescription(clean(value.description(),8000));p.setItemNumber(value.itemNumber());p.setBrand(value.brand());p.setCategoryId(value.categoryIds().isEmpty()?null:value.categoryIds().get(0));p.setMediaGallery(new ArrayList<>(value.gallery()));
   p.setCatalogData(new ProductCatalogData(clean(value.specification(),1000),value.model(),value.packaging(),List.copyOf(value.categoryIds()),value.supplierId(),null,owner(),Instant.now()));
   if(value.translationsReviewed()){var d=p.getCatalogData();p.setCatalogData(new ProductCatalogData(d.specification(),d.model(),d.packaging(),d.categoryIds(),d.supplierId(),sourceHash(p),d.reviewedBy(),d.reviewedAt()));}
   products.saveAndFlush(p);result.add(new Profile(input(p),true,sources(p.getId()).stream().map(i->i.id).toList()));
  }return result;
 }
 @Transactional public MediaGalleryItem upload(String id,RecommendationImageValidator.Image image,String sourceUrl,String label,boolean verified){
  owned(id,false);if(!verified||label==null||label.length()>200)throw invalid("gallery.invalid");
  try{var uri=java.net.URI.create(sourceUrl);if(!"https".equals(uri.getScheme())||uri.getHost()==null||uri.getUserInfo()!=null||uri.getRawQuery()!=null||uri.getRawFragment()!=null||sourceUrl.length()>2048)throw new IllegalArgumentException();}catch(Exception error){throw invalid("gallery.invalid");}
  var blob=images.findByMerchantIdAndImageHash(owner(),image.hash()).orElseGet(()->{var value=new RecommendationImage();value.id=UUID.randomUUID().toString();value.merchantId=owner();value.imageHash=image.hash();value.contentType=image.contentType();value.content=image.content();return binaries.persist(value);});
  return media(new RecommendationItem.Picture(blob.id,"/api/storefront/recommendation-images/"+blob.id,image.hash(),sourceUrl,sourceUrl,label,Instant.now()));
 }
}
