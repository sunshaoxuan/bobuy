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

/** One transaction: private canonical master first, then the independent issue offer. */
@Service
public class RecommendationProductIntake {
 private final ProductRepository products;private final UserRepository users;private final RecommendationImageRepository images;
 private final MediaBinaryService binaries;private final RecommendationService recommendations;
 public RecommendationProductIntake(ProductRepository products,UserRepository users,RecommendationImageRepository images,MediaBinaryService binaries,RecommendationService recommendations){this.products=products;this.users=users;this.images=images;this.binaries=binaries;this.recommendations=recommendations;}
 public record Input(@jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Pattern(regexp="[a-zA-Z0-9-]{16,100}") String requestId,@jakarta.validation.constraints.NotNull @jakarta.validation.Valid RecommendationFacts facts,@jakarta.validation.constraints.Size(max=1000) String specification,@jakarta.validation.constraints.Size(max=200) String brand,boolean reviewed,boolean displayUploadedImage,long version,String officialProductUrl,List<String> officialImages,String existingProductId,Long existingProductVersion){
  public Input(String requestId,RecommendationFacts facts,String specification,String brand,boolean reviewed,boolean displayUploadedImage,long version,String officialProductUrl,List<String> officialImages){this(requestId,facts,specification,brand,reviewed,displayUploadedImage,version,officialProductUrl,officialImages,null,null);}
 }
 public record Result(String productId,long productVersion,boolean created,RecommendationService.Detail detail){}
 private static ApiException invalid(){return new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.invalid");}
 @Transactional public Result save(Long postId,Input input,RecommendationImageValidator.Image uploaded,List<RecommendationImageValidator.Image> official){
  Long owner=MerchantScope.current();if(owner==null)throw new ApiException(ErrorCode.FORBIDDEN,"error.auth.forbidden");users.lockById(owner).orElseThrow();
  if(input==null||input.requestId()==null||!input.requestId().matches("[a-zA-Z0-9-]{16,100}")||!input.reviewed()||input.facts()==null||input.facts().name()==null||input.facts().name().isBlank()||input.facts().name().length()>200||input.specification()!=null&&input.specification().length()>1000||input.brand()!=null&&input.brand().length()>200)throw invalid();
  var checked=new RecommendationItem();input.facts().apply(checked);
  var before=recommendations.get(postId,false);if(before.post().published())throw invalid();
  if(input.displayUploadedImage()&&uploaded==null)throw invalid();
  var urls=input.officialImages()==null?List.<String>of():input.officialImages();if(urls.size()!=official.size()||urls.size()>20||new HashSet<>(urls).size()!=urls.size())throw invalid();
  if(input.existingProductId()!=null&&!input.existingProductId().isBlank())return appendExisting(postId,input,uploaded,official,urls,owner,before);
  String id="bobuy-intake-"+UUID.nameUUIDFromBytes((owner+":"+input.requestId()).getBytes(StandardCharsets.UTF_8));
  String digest;
  try{digest=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsBytes(List.of(input.facts(),Objects.toString(input.specification(),""),Objects.toString(input.brand(),""),input.displayUploadedImage()&&uploaded!=null?uploaded.hash():"",urls,official.stream().map(RecommendationImageValidator.Image::hash).toList()))));}catch(Exception error){throw new IllegalStateException(error);}
  var existing=products.lockById(id);boolean created=existing.isEmpty();Product product;
  if(existing.isPresent()){
   product=existing.get();if(!owner.equals(product.getMerchantId())||product.isDeleted()||!digest.equals(product.getAttributes().get("intakeDigest")))throw invalid();
  }else{
   if(before.post().version()!=input.version())throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.conflict");
   if(checked.itemNumber!=null&&products.findAllByMerchantIdAndItemNumber(owner,checked.itemNumber).stream().anyMatch(p->Objects.equals(ProductCatalogService.text(p.getCatalogData()==null?null:p.getCatalogData().specification(),"ja-JP"),Objects.toString(input.specification(),""))))
    throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.conflict");
   product=new Product();product.setId(id);product.setMerchantId(owner);product.setName(new HashMap<>(Map.of("ja-JP",checked.name)));product.setDescription(new HashMap<>());product.setItemNumber(checked.itemNumber);product.setBrand(input.brand());
   product.setBasePrice(0);product.setCurrency("JPY");product.setVisibilityStatus(ProductVisibility.DRAFTER_ONLY);product.setOrderMethod(OrderMethod.PRE_ORDER);
   product.setAttributes(new HashMap<>(Map.of("recommendationProfile","true","pricingStatus","REQUIRES_REVIEW","intakeDigest",digest)));
   var gallery=new ArrayList<MediaGalleryItem>();
   for(int index=0;index<official.size();index++){var media=persist(owner,official.get(index),urls.get(index),"OFFICIAL_PRODUCT",checked.name);if(gallery.stream().noneMatch(p->p.getUrl().equals(media.getUrl())))gallery.add(media);}
   if(input.displayUploadedImage()){var media=persist(owner,uploaded,"urn:bobuy:user-upload:"+uploaded.hash(),"USER_PROVIDED",checked.name);if(gallery.stream().noneMatch(p->p.getUrl().equals(media.getUrl())))gallery.add(media);}
   product.setMediaGallery(gallery);product.setCatalogData(new ProductCatalogData(input.specification()==null||input.specification().isBlank()?Map.of():Map.of("ja-JP",input.specification().trim()),null,null,List.of(),null,null,owner,Instant.now()));products.saveAndFlush(product);
  }
  // A clue-only image is never persisted. An incomplete master remains private and unlinked.
  var detail=product.getMediaGallery().isEmpty()?recommendations.get(postId,false):recommendations.fromProduct(postId,product.getId(),product.getRecordVersion(),input.facts(),input.version(),true);
  return new Result(product.getId(),product.getRecordVersion(),created,detail);
 }
 private Result appendExisting(Long postId,Input input,RecommendationImageValidator.Image uploaded,List<RecommendationImageValidator.Image> official,List<String> urls,Long owner,RecommendationService.Detail before){
  var p=products.lockById(input.existingProductId()).filter(value->owner.equals(value.getMerchantId())&&!value.isDeleted()&&value.getCatalogData()!=null).orElseThrow(RecommendationProductIntake::invalid);
  if(!Objects.equals(p.getItemNumber(),input.facts().itemNumber())||!ProductCatalogService.text(p.getName(),"ja-JP").equals(input.facts().name()))throw invalid();
  var wanted=new HashSet<String>();official.forEach(i->wanted.add(i.hash()));if(input.displayUploadedImage())wanted.add(uploaded.hash());
  boolean alreadyPresent=wanted.stream().allMatch(hash->p.getMediaGallery().stream().anyMatch(image->hash.equals(image.getSha256())));
  boolean linked=before.items().stream().anyMatch(i->p.getId().equals(i.productId)&&Objects.equals(i.offerStart,input.facts().offerStart())&&Objects.equals(i.offerEnd,input.facts().offerEnd())&&Objects.equals(i.couponStart,input.facts().couponStart())&&Objects.equals(i.couponEnd,input.facts().couponEnd()));
  if(!Objects.equals(p.getRecordVersion(),input.existingProductVersion())&&!(alreadyPresent&&linked))throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.conflict");
  if(!alreadyPresent){
   if(before.post().version()!=input.version())throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.conflict");
   var gallery=new ArrayList<>(p.getMediaGallery());
   for(int n=0;n<official.size();n++){var media=persist(owner,official.get(n),urls.get(n),"OFFICIAL_PRODUCT",input.facts().name());if(gallery.stream().noneMatch(i->i.getUrl().equals(media.getUrl())))gallery.add(media);}
   if(input.displayUploadedImage()){var media=persist(owner,uploaded,"urn:bobuy:user-upload:"+uploaded.hash(),"USER_PROVIDED",input.facts().name());if(gallery.stream().noneMatch(i->i.getUrl().equals(media.getUrl())))gallery.add(media);}
   p.setMediaGallery(gallery);products.saveAndFlush(p);
  }
  var detail=p.getMediaGallery().isEmpty()?recommendations.get(postId,false):recommendations.fromProduct(postId,p.getId(),p.getRecordVersion(),input.facts(),input.version(),true);
  return new Result(p.getId(),p.getRecordVersion(),false,detail);
 }
 private MediaGalleryItem persist(Long owner,RecommendationImageValidator.Image image,String source,String type,String label){
  var blob=images.findByMerchantIdAndImageHash(owner,image.hash()).map(existing->{if(!"PUBLIC".equals(existing.accessScope))throw invalid();return binaries.reuse(existing,image.content());}).orElseGet(()->{var row=new RecommendationImage();row.id=UUID.randomUUID().toString();row.merchantId=owner;row.imageHash=image.hash();row.contentType=image.contentType();row.content=image.content();return binaries.persist(row);});
  var media=new MediaGalleryItem("/api/storefront/recommendation-images/"+blob.id,MediaType.IMAGE,Map.of("ja-JP",label),true,source,type.equals("USER_PROVIDED")?"user-upload":java.net.URI.create(source).getHost(),type);media.setSha256(image.hash());return media;
 }
}
