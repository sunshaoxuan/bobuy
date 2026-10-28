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

/** PG is retained on every write; object storage is an optional verified read preference. */
@Service
public class MediaBinaryService {
 private final RecommendationImageRepository images; private final MediaTransferRepository transfers;
 private final MediaObjectStore objects; private final boolean preferObject;
 private final MediaReferenceCatalog catalog;
 public MediaBinaryService(RecommendationImageRepository images,MediaTransferRepository transfers,MediaObjectStore objects,MediaReferenceCatalog catalog,@Value("${bobbuy.media.prefer-object:false}") boolean preferObject){this.images=images;this.transfers=transfers;this.objects=objects;this.catalog=catalog;this.preferObject=preferObject;}
 public static String sha(byte[] bytes){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));}catch(Exception e){throw new IllegalStateException("SHA256 unavailable");}}
 private static RecommendationImage actual(RecommendationImage image){return (RecommendationImage)org.hibernate.Hibernate.unproxy(image);}
 public static String key(RecommendationImage image){String hash=sha(actual(image).content);return "blobs/v1/sha256/"+hash.substring(0,2)+"/"+hash;}
 @Transactional public RecommendationImage persist(RecommendationImage image){var saved=actual(images.saveAndFlush(image));enqueue(saved);return saved;}
 private void enqueue(RecommendationImage image){
  image=actual(image);
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
  var transfer=preferObject?transfers.findById(authorized.id).orElse(null):null;
  if(transfer!=null&&matches(transfer,authorized)&&"VERIFIED".equals(transfer.state))try{
   var value=objects.get(transfer.objectKey);
   if(value.bytes().length==transfer.byteLength&&sha(value.bytes()).equals(transfer.rawSha256)&&Objects.equals(value.contentType(),authorized.contentType))return value.bytes();
   throw new IllegalStateException("Media integrity mismatch");
  }catch(RuntimeException error){LoggerFactory.getLogger(MediaBinaryService.class).warn("Object media read failed; retained PostgreSQL copy used");}
  return authorized.content;
 }
 static boolean matches(MediaTransfer row,RecommendationImage image){image=actual(image);return row.byteLength==image.content.length&&row.rawSha256.equals(sha(image.content))&&row.objectKey.equals(key(image))&&row.contentType.equals(image.contentType);}
 public record Claim(String imageId,String token,String key,String sha256,String type,byte[] bytes) {}
 @Transactional public Claim claim(){
  catalog.lock();
  var now=Instant.now();
  for(String id:transfers.pending(now,PageRequest.of(0,10))){
   var row=transfers.lock(id).orElseThrow();if("VERIFIED".equals(row.state)||(row.leaseUntil!=null&&!row.leaseUntil.isBefore(now)))continue;
   var image=actual(images.findById(id).orElseThrow());if(!matches(row,image)){enqueue(image);row=transfers.lock(id).orElseThrow();}
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
