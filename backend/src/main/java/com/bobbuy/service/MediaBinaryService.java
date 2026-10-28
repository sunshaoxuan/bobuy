package com.bobbuy.service;

import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

/** Retained PG media stays recoverable. Object-only new uploads require explicit activation. */
@Service
public class MediaBinaryService {
 private final RecommendationImageRepository images; private final MediaTransferRepository transfers;
 private final MediaObjectStore objects; private final boolean preferObject;private final boolean objectOnly;
 private final MediaReferenceCatalog catalog;
 public MediaBinaryService(RecommendationImageRepository images,MediaTransferRepository transfers,MediaObjectStore objects,MediaReferenceCatalog catalog,boolean preferObject){this(images,transfers,objects,catalog,preferObject,false);}
 @org.springframework.beans.factory.annotation.Autowired public MediaBinaryService(RecommendationImageRepository images,MediaTransferRepository transfers,MediaObjectStore objects,MediaReferenceCatalog catalog,@Value("${bobbuy.media.prefer-object:false}") boolean preferObject,@Value("${bobbuy.media.object-only-writes:false}") boolean objectOnly){this.images=images;this.transfers=transfers;this.objects=objects;this.catalog=catalog;this.preferObject=preferObject;this.objectOnly=objectOnly;if(objectOnly&&(!preferObject||(objects instanceof RustFsObjectStore store&&!store.enabled())))throw new IllegalStateException("Object-only writes require enabled object reads");}
 public static String sha(byte[] bytes){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));}catch(Exception e){throw new IllegalStateException("SHA256 unavailable");}}
 private static RecommendationImage actual(RecommendationImage image){return (RecommendationImage)org.hibernate.Hibernate.unproxy(image);}
 public static String rawHash(RecommendationImage image){image=actual(image);return image.content==null?Objects.requireNonNull(image.rawSha256,"Missing media hash"):sha(image.content);}
 public static String key(RecommendationImage image){String hash=rawHash(image);return "blobs/v1/sha256/"+hash.substring(0,2)+"/"+hash;}
 @Transactional public RecommendationImage persist(RecommendationImage image){
  if(!objectOnly){var saved=actual(images.saveAndFlush(image));enqueue(saved);return saved;}
  image=actual(image);return persistObject(image,Objects.requireNonNull(image.content,"Upload bytes required"));
 }
 private RecommendationImage persistObject(RecommendationImage image,byte[] bytes){
  if(bytes.length<1||bytes.length>RecommendationImageValidator.MAX_BYTES)throw new IllegalArgumentException("Invalid media size");String hash=sha(bytes);
  if(image.rawSha256!=null&&!image.rawSha256.equals(hash))throw new IllegalArgumentException("Media identity is immutable; upload a new media ID");
  catalog.lock();var existing=images.findById(image.id).map(MediaBinaryService::actual).orElse(null);
  if(existing!=null&&!rawHash(existing).equals(hash))throw new IllegalArgumentException("Media identity is immutable; upload a new media ID");
  String objectKey="blobs/v1/sha256/"+hash.substring(0,2)+"/"+hash;
  try{MediaObjectStore.ObjectData copied;try{copied=objects.get(objectKey);}catch(MediaObjectStore.Missing missing){objects.put(objectKey,bytes,image.contentType,hash);copied=objects.get(objectKey);}if(!Arrays.equals(copied.bytes(),bytes)||!Objects.equals(copied.contentType(),image.contentType)||!hash.equals(copied.metadata().get("raw-sha256")))throw new IllegalStateException("Object integrity mismatch");}catch(RuntimeException failure){throw new MediaStorageUnavailableException();}
  // Existing retained PG bytes are never cleared by enabling the new-upload mode.
  image.content=existing==null?null:existing.content;image.rawSha256=hash;image.byteLength=bytes.length;var saved=actual(images.saveAndFlush(image));catalog.bindChecked(saved,bytes);
  var row=transfers.lock(saved.id).orElseGet(()->{var value=new MediaTransfer();value.imageId=saved.id;return value;});row.rawSha256=hash;row.byteLength=bytes.length;row.contentType=saved.contentType;row.objectKey=objectKey;row.state="VERIFIED";row.verifiedAt=Instant.now();row.leaseToken=null;row.leaseUntil=null;row.updatedAt=Instant.now();transfers.saveAndFlush(row);return saved;
 }
 @Transactional public RecommendationImage reuse(RecommendationImage existing,byte[] checkedBytes){if(!objectOnly)return existing;existing=actual(existing);if(!rawHash(existing).equals(sha(checkedBytes)))throw new IllegalArgumentException("Media identity mismatch");return persistObject(existing,checkedBytes);}
 private void enqueue(RecommendationImage image){
  image=actual(image);
  if(image.content==null){var row=transfers.findById(image.id).orElseThrow(()->new IllegalStateException("Object-only media has no verified transfer"));if(!matches(row,image)||!"VERIFIED".equals(row.state))throw new IllegalStateException("Object-only media is not verified");return;}
  catalog.bind(image);
  String hash=sha(image.content),id=image.id;var row=transfers.lock(id).orElseGet(()->{var t=new MediaTransfer();t.imageId=id;return t;});
  if(!hash.equals(row.rawSha256)||!Objects.equals(key(image),row.objectKey)||!Objects.equals(row.contentType,image.contentType)||row.byteLength!=image.content.length){
   row.rawSha256=hash;row.objectKey=key(image);row.contentType=image.contentType;row.byteLength=image.content.length;row.state="PENDING";row.verifiedAt=null;row.leaseToken=null;row.leaseUntil=null;row.updatedAt=Instant.now();transfers.saveAndFlush(row);
  }
 }
 /** Cursor scan is resumable. Inserts during the scan already enqueue transactionally. */
 @Transactional public String backfillPage(String after,int limit){
  if(limit<1||limit>100)throw new IllegalArgumentException("Invalid media batch size");
  var page=images.findByIdGreaterThanOrderByIdAsc(after==null?"":after,PageRequest.of(0,limit));
  page.forEach(image->enqueue(images.lock(image.id).orElseThrow()));return page.isEmpty()?null:page.get(page.size()-1).id;
 }
 /** Caller MUST authorize the image through the existing public/private service first. */
 @Transactional(readOnly=true) public byte[] read(RecommendationImage authorized){
  authorized=actual(authorized);
  var transfer=(preferObject||authorized.content==null)?transfers.findById(authorized.id).orElse(null):null;
  if(transfer!=null&&matches(transfer,authorized)&&"VERIFIED".equals(transfer.state))try{
   var value=objects.get(transfer.objectKey);
   if(value.bytes().length==transfer.byteLength&&sha(value.bytes()).equals(transfer.rawSha256)&&Objects.equals(value.contentType(),authorized.contentType)&&transfer.rawSha256.equals(value.metadata().get("raw-sha256")))return value.bytes();
   throw new IllegalStateException("Media integrity mismatch");
  }catch(RuntimeException error){if(authorized.content!=null)LoggerFactory.getLogger(MediaBinaryService.class).warn("Object media read failed; retained PostgreSQL copy used");}
  if(authorized.content==null)throw new MediaStorageUnavailableException();return authorized.content;
 }
 static boolean matches(MediaTransfer row,RecommendationImage image){image=actual(image);return row.byteLength==(image.content==null?image.byteLength:image.content.length)&&row.rawSha256.equals(rawHash(image))&&row.objectKey.equals(key(image))&&row.contentType.equals(image.contentType);}
 public record Claim(String imageId,String token,String key,String sha256,String type,byte[] bytes) {}
 @Transactional public Claim claim(){
  catalog.lock();
  var now=Instant.now();
  for(String id:transfers.pending(now,PageRequest.of(0,10))){
   var row=transfers.lock(id).orElseThrow();if("VERIFIED".equals(row.state)||(row.leaseUntil!=null&&!row.leaseUntil.isBefore(now)))continue;
   var image=actual(images.findById(id).orElseThrow());if(!matches(row,image)){enqueue(image);row=transfers.lock(id).orElseThrow();}
   if(image.content==null)throw new IllegalStateException("Object-only rows cannot be copied from PostgreSQL");
   row.leaseToken=UUID.randomUUID().toString();row.leaseUntil=now.plusSeconds(120);row.attempts++;row.updatedAt=now;transfers.saveAndFlush(row);
   catalog.hold(row.rawSha256,row.leaseUntil);
   return new Claim(id,row.leaseToken,row.objectKey,row.rawSha256,row.contentType,image.content.clone());
  }return null;
 }
 @Transactional public void finish(Claim claim,boolean success){
  catalog.lock();
  var row=transfers.lock(claim.imageId()).orElseThrow();if(!Objects.equals(row.leaseToken,claim.token()))return;
  var image=actual(images.findById(claim.imageId()).orElseThrow());if(!matches(row,image)){enqueue(image);return;}
  row.state=success?"VERIFIED":"RETRY";row.verifiedAt=success?Instant.now():null;row.leaseToken=null;row.leaseUntil=success?null:Instant.now().plusSeconds(30);row.updatedAt=Instant.now();transfers.saveAndFlush(row);
 }
}
