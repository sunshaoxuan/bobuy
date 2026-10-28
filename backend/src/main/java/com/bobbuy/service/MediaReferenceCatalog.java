package com.bobbuy.service;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;

/** Explicit retention roots and serialized candidate review. No object deletion exists here. */
@Service
public class MediaReferenceCatalog {
 private final MediaBlobRepository blobs;private final MediaReferenceRepository refs;
 private final MediaCatalogGuardRepository guard;private final RecommendationImageRepository images;private final MediaTransferRepository transfers;
 public MediaReferenceCatalog(MediaBlobRepository blobs,MediaReferenceRepository refs,MediaCatalogGuardRepository guard,RecommendationImageRepository images,MediaTransferRepository transfers){this.blobs=blobs;this.refs=refs;this.guard=guard;this.images=images;this.transfers=transfers;}
 @PostConstruct public void initialize(){if(!guard.existsById(1L))guard.saveAndFlush(new MediaCatalogGuard());}
 public void lock(){guard.lock().orElseThrow(()->new IllegalStateException("Media catalog guard unavailable"));}
 @Transactional public void bind(RecommendationImage image){
  image=(RecommendationImage)org.hibernate.Hibernate.unproxy(image);bindChecked(image,image.content);
 }
 @Transactional public void bindChecked(RecommendationImage image,byte[] checkedBytes){
  image=(RecommendationImage)org.hibernate.Hibernate.unproxy(image);
  lock();String hash=MediaBinaryService.rawHash(image);long length=image.content==null?image.byteLength:image.content.length;
  if(checkedBytes!=null&&(!hash.equals(MediaBinaryService.sha(checkedBytes))||checkedBytes.length!=length))throw new IllegalStateException("Invalid checked media bytes");
  var blob=blobs.findById(hash).map(b->(MediaBlob)org.hibernate.Hibernate.unproxy(b)).orElse(null);
  if(blob!=null){
   if(blob.byteLength!=length||!blob.contentType.equals(image.contentType))throw new IllegalStateException("Content digest collision or inconsistent type");
   for(var ref:refs.findByBlobSha256(hash)){var prior=(RecommendationImage)org.hibernate.Hibernate.unproxy(images.findById(ref.imageId).orElseThrow(()->new IllegalStateException("Broken media retention root")));if(prior.content!=null&&checkedBytes!=null&&!Arrays.equals(prior.content,checkedBytes))throw new IllegalStateException("Content digest collision");}
  }else{blob=new MediaBlob();blob.sha256=hash;blob.byteLength=length;blob.contentType=image.contentType;}
  blob.gcCandidateAt=null;blobs.saveAndFlush(blob);var ref=new MediaReference();ref.imageId=image.id;ref.blobSha256=hash;refs.saveAndFlush(ref);
 }
 @Transactional public void hold(String hash,Instant until){lock();var blob=(MediaBlob)org.hibernate.Hibernate.unproxy(blobs.findById(hash).orElseThrow());if(blob.busyUntil==null||blob.busyUntil.isBefore(until))blob.busyUntil=until;blob.gcCandidateAt=null;blobs.saveAndFlush(blob);}
 private boolean unoccupied(MediaBlob blob,Instant now){return !refs.existsByBlobSha256(blob.sha256)&&(blob.busyUntil==null||blob.busyUntil.isBefore(now))&&!transfers.existsByRawSha256(blob.sha256)&&images.findAll().stream().noneMatch(i->MediaBinaryService.rawHash(i).equals(blob.sha256));}
 @Transactional public List<String> markGcCandidates(){lock();var now=Instant.now();var marked=new ArrayList<String>();for(var blob:blobs.findAll()){if(unoccupied(blob,now)){if(blob.gcCandidateAt==null)blob.gcCandidateAt=now;marked.add(blob.sha256);}else blob.gcCandidateAt=null;blobs.save(blob);}return marked;}
 /** Audit-only review, rechecking under the same guard used by uploads. Not a deletion permit. */
 @Transactional public List<String> reviewGcCandidates(){lock();var now=Instant.now();return blobs.findAll().stream().filter(b->b.gcCandidateAt!=null&&b.gcCandidateAt.isBefore(now.minus(Duration.ofHours(24)))&&unoccupied(b,now)).map(b->b.sha256).toList();}
}
