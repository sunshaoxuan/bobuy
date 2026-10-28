package com.bobbuy.service;
import com.bobbuy.api.response.*;
import com.bobbuy.model.RecommendationImage;
import com.bobbuy.repository.RecommendationImageRepository;
import com.bobbuy.security.MerchantScope;
import java.security.MessageDigest;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Image bytes live in the existing PostgreSQL image table. Receipts stay private. */
@Service
public class ImageStorageService {
 private final RecommendationImageRepository images;
 private final MediaBinaryService binaries;
 public ImageStorageService(RecommendationImageRepository images,MediaBinaryService binaries) {this.images=images;this.binaries=binaries;}
 /** Product photography retains its existing public media semantics. */
 @Transactional public String saveBase64(String value) {var saved=save(value,"PUBLIC");return saved==null?null:saved.publicUrl();}
 @Transactional public UploadResult saveBase64ToObject(String value) {return save(value,"PRIVATE");}
 private UploadResult save(String value,String scope) {
  if(value==null || value.isBlank()) return null;
  long owner=owner();
  if(value.length()>RecommendationImageValidator.MAX_BYTES*4L/3+256) throw invalid();
  String raw=value;
  if(value.startsWith("data:")) {
   int comma=value.indexOf(',');if(comma<0 || !value.substring(0,comma).matches("data:image/(png|jpeg);base64")) throw invalid();
   raw=value.substring(comma+1);
  }
  byte[] bytes;
  try {bytes=Base64.getDecoder().decode(raw);}catch(IllegalArgumentException e){throw invalid();}
  var image=RecommendationImageValidator.validate(bytes);
  String hash;
  try {var digest=MessageDigest.getInstance("SHA-256");digest.update(scope.getBytes(java.nio.charset.StandardCharsets.UTF_8));hash=HexFormat.of().formatHex(digest.digest(bytes));}
  catch(java.security.NoSuchAlgorithmException e){throw new IllegalStateException("Image hashing unavailable");}
  var blob=images.findByMerchantIdAndImageHash(owner,hash).orElseGet(()->{
   var b=new RecommendationImage();b.id=UUID.randomUUID().toString();b.merchantId=owner;b.imageHash=hash;
   b.contentType=image.contentType();b.content=image.content();b.accessScope=scope;return binaries.persist(b);
  });
  String url=scope.equals("PRIVATE")?"/api/merchant/media/"+blob.id:"/api/storefront/recommendation-images/"+blob.id;
  return new UploadResult("pg-image:"+blob.id,url);
 }
 @Transactional(readOnly=true) public RecommendationImage privateImage(String id) {
  long current=owner();
  return images.findById(id).filter(b->"PRIVATE".equals(b.accessScope) && Objects.equals(b.merchantId,current))
   .orElseThrow(()->new ApiException(ErrorCode.RESOURCE_NOT_FOUND,"error.procurement.receipt.not_found"));
 }
 @Transactional(readOnly=true) public String generatePreviewUrl(String key) {
  if(key==null || !key.startsWith("pg-image:")) return null;
  var blob=privateImage(key.substring("pg-image:".length()));return "/api/merchant/media/"+blob.id;
 }
 private long owner() {Long id=MerchantScope.current();if(id==null)throw new ApiException(ErrorCode.FORBIDDEN,"Merchant identity required");return id;}
 private ApiException invalid(){return new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.image");}
 public record UploadResult(String objectKey,String publicUrl) {}
}
