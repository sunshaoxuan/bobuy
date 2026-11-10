package com.bobbuy.api;

import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.service.*;
import com.bobbuy.security.JwtTokenService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Offline H2 + fake object adapter only. No network/RustFS/container/production access. */
@SpringBootTest(properties={"bobbuy.media.prefer-object=true","bobbuy.security.header-auth.enabled=false"})
@AutoConfigureMockMvc
class MediaTransferIntegrationTest {
 @Autowired MediaBinaryService binaries;@Autowired MediaTransferWorker worker;
 @Autowired RecommendationImageRepository images;@Autowired MediaTransferRepository transfers;
 @Autowired BobbuyStore store;@Autowired UserRepository users;@Autowired JwtTokenService tokens;
 @Autowired PlatformTransactionManager transactions;@Autowired MockMvc mvc;
 @Autowired MediaReferenceRepository refs;@Autowired MediaBlobRepository blobs;@Autowired MediaReferenceCatalog catalog;
 @MockBean MediaObjectStore objects;
 final Map<String,MediaObjectStore.ObjectData> copied=new ConcurrentHashMap<>();
 final Set<String> created=ConcurrentHashMap.newKeySet();
 @BeforeEach void setup(){store.seed();transfers.deleteAll();refs.deleteAll();blobs.deleteAll();reset(objects);copied.clear();
  doAnswer(call->{String key=call.getArgument(0),type=call.getArgument(2),hash=call.getArgument(3);byte[] bytes=call.getArgument(1);copied.put(key,new MediaObjectStore.ObjectData(bytes.clone(),type,Map.of("raw-sha256",hash)));return null;}).when(objects).put(anyString(),any(),anyString(),anyString());
  when(objects.get(anyString())).thenAnswer(call->{var value=copied.get(call.getArgument(0));if(value==null)throw new MediaObjectStore.Missing();return value;});
 }
 @AfterEach void cleanup(){transfers.deleteAll();refs.deleteAll();blobs.deleteAll();created.forEach(images::deleteById);created.clear();}
 RecommendationImage image(String id,String scope,byte[] content){var i=new RecommendationImage();i.id="media-synthetic-"+id;i.merchantId=1000L;i.accessScope=scope;i.contentType="image/png";i.content=content;i.imageHash=MediaBinaryService.sha((id+scope+Arrays.toString(content)).getBytes());created.add(i.id);return binaries.persist(i);}
 RecommendationImage image(String id){return image(id,"PUBLIC",new byte[]{1,2,3,4});}
 void expire(String id){var row=transfers.findById(id).orElseThrow();row.leaseUntil=Instant.now().minusSeconds(1);transfers.saveAndFlush(row);}
 @Test void pgAndOutboxCommitOrRollbackTogether(){
  assertThatThrownBy(()->new TransactionTemplate(transactions).execute(status->{image("rollback");throw new IllegalStateException("synthetic transaction failure");})).isInstanceOf(IllegalStateException.class);
  assertThat(images.findById("media-synthetic-rollback")).isEmpty();assertThat(transfers.findById("media-synthetic-rollback")).isEmpty();verifyNoInteractions(objects);
 }
 @Test void cursorBackfillIsIdempotentAndLaterLowerIdInsertHasItsOwnOutbox(){
  var b=image("b");transfers.deleteAll();assertThat(binaries.backfillPage("",1)).isNotNull();
  binaries.backfillPage("",100);long count=transfers.count();binaries.backfillPage("",100);assertThat(transfers.count()).isEqualTo(count);
  var a=image("a");assertThat(transfers.findById(a.id)).isPresent();assertThat(transfers.findById(b.id)).isPresent();verifyNoInteractions(objects);
 }
 @Test void verifiedCopyKeepsPgBytesAndCorruptionOrOutageFallsBack(){
  var i=image("verified");assertThat(worker.transferOne()).isTrue();var row=transfers.findById(i.id).orElseThrow();assertThat(row.state).isEqualTo("VERIFIED");
  assertThat(binaries.read(i)).containsExactly(i.content);assertThat(images.findById(i.id).orElseThrow().content).containsExactly(i.content);
  copied.put(row.objectKey,new MediaObjectStore.ObjectData(new byte[]{9,9,9,9},i.contentType,Map.of("raw-sha256",row.rawSha256)));
  assertThat(binaries.read(i)).containsExactly(i.content);copied.clear();assertThat(binaries.read(i)).containsExactly(i.content);
 }
 @Test void incorrectHashMetadataNeverMarksComplete(){
  var i=image("wrong-metadata");doReturn(new MediaObjectStore.ObjectData(i.content,i.contentType,Map.of("raw-sha256","wrong"))).when(objects).get(anyString());
  worker.transferOne();assertThat(transfers.findById(i.id).orElseThrow().state).isEqualTo("RETRY");assertThat(binaries.read(i)).containsExactly(i.content);
 }
 @Test void lostUploadResponseRetriesSameImmutableKeyWithoutDroppingPg(){
  var i=image("lost-response");doAnswer(call->{String key=call.getArgument(0);copied.put(key,new MediaObjectStore.ObjectData(i.content,i.contentType,Map.of("raw-sha256",MediaBinaryService.sha(i.content))));throw new IllegalStateException("synthetic response loss");}).doNothing().when(objects).put(anyString(),any(),anyString(),anyString());
  worker.transferOne();assertThat(transfers.findById(i.id).orElseThrow().state).isEqualTo("RETRY");assertThat(images.findById(i.id)).isPresent();
  expire(i.id);worker.transferOne();assertThat(copied).hasSize(1);var row=transfers.findById(i.id).orElseThrow();assertThat(row.state).isEqualTo("VERIFIED");assertThat(row.attempts).isEqualTo(2);
 }
 @Test void twoConcurrentClaimsCannotOwnSameLease()throws Exception{
  image("concurrent");var start=new CountDownLatch(1);var executor=Executors.newFixedThreadPool(2);
  try{var a=executor.submit(()->{start.await();return binaries.claim();});var b=executor.submit(()->{start.await();return binaries.claim();});start.countDown();assertThat(Arrays.asList(a.get(10,TimeUnit.SECONDS),b.get(10,TimeUnit.SECONDS)).stream().filter(Objects::nonNull).count()).isEqualTo(1);}finally{executor.shutdownNow();}
 }
 @Test void expiredLeaseCanResumeButStaleCompletionCannotWin(){
  var i=image("lease");var old=binaries.claim();expire(i.id);var current=binaries.claim();assertThat(current.token()).isNotEqualTo(old.token());binaries.finish(old,true);
  assertThat(transfers.findById(i.id).orElseThrow().state).isEqualTo("PENDING");binaries.finish(current,false);assertThat(transfers.findById(i.id).orElseThrow().state).isEqualTo("RETRY");
 }
 @Test void sourceChangeDuringTransferInvalidatesOldVerification(){
  var i=image("source-change");var claim=binaries.claim();i.content=new byte[]{5,6};binaries.persist(i);binaries.finish(claim,true);
  var next=transfers.findById(i.id).orElseThrow();assertThat(next.state).isEqualTo("PENDING");assertThat(next.rawSha256).isEqualTo(MediaBinaryService.sha(i.content));assertThat(next.objectKey).isNotEqualTo(claim.key());
  worker.transferOne();assertThat(transfers.findById(i.id).orElseThrow().state).isEqualTo("VERIFIED");assertThat(binaries.read(i)).containsExactly(5,6);
 }
 @Test void identicalBytesAcrossPublicPrivatePathsShareOnePhysicalObject(){
  var a=image("shared-public","PUBLIC",new byte[]{4,5,6});var b=image("shared-private","PRIVATE",a.content.clone());
  assertThat(a.id).isNotEqualTo(b.id);assertThat(refs.findById(a.id).orElseThrow().blobSha256).isEqualTo(refs.findById(b.id).orElseThrow().blobSha256);assertThat(blobs.count()).isEqualTo(1);
  worker.transferOne();worker.transferOne();assertThat(copied).hasSize(1);verify(objects,times(1)).put(anyString(),any(),anyString(),anyString());assertThat(refs.count()).isEqualTo(2);
 }
 @Test void concurrentDifferentMediaUploadsBindOneBlobWithoutLostReferences()throws Exception{
  var start=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(2);
  try{var a=pool.submit(()->{start.await();return image("parallel-a");});var b=pool.submit(()->{start.await();return image("parallel-b");});start.countDown();a.get(10,TimeUnit.SECONDS);b.get(10,TimeUnit.SECONDS);assertThat(blobs.count()).isEqualTo(1);assertThat(refs.count()).isEqualTo(2);}finally{pool.shutdownNow();}
 }
 @Test void finalPermanentFixtureReleaseOnlyCreatesDelayedReviewAndNewReferenceCancelsIt(){
  var a=image("gc-a");var b=image("gc-b");String hash=MediaBinaryService.sha(a.content);
  transfers.deleteById(a.id);refs.deleteById(a.id);images.deleteById(a.id);assertThat(catalog.markGcCandidates()).doesNotContain(hash);
  // Only disposable in-memory fixtures are permanently removed, never production media.
  transfers.deleteById(b.id);refs.deleteById(b.id);images.deleteById(b.id);assertThat(catalog.markGcCandidates()).contains(hash);assertThat(catalog.reviewGcCandidates()).isEmpty();
  var blob=blobs.findById(hash).orElseThrow();blob.gcCandidateAt=Instant.now().minusSeconds(90000);blobs.saveAndFlush(blob);assertThat(catalog.reviewGcCandidates()).contains(hash);
  image("gc-new-reference");assertThat(catalog.reviewGcCandidates()).doesNotContain(hash);assertThat(blobs.findById(hash).orElseThrow().gcCandidateAt).isNull();verifyNoInteractions(objects);
 }
 @Test void damagedReferenceCountCannotCollectRetainedMedia(){
  var i=image("retained-root");String hash=MediaBinaryService.sha(i.content);transfers.deleteById(i.id);refs.deleteById(i.id);
  assertThat(catalog.markGcCandidates()).doesNotContain(hash);assertThat(images.findById(i.id)).isPresent();
 }
 @Test void mismatchedBlobMetadataRejectsBindingAndRollsBackNewMedia(){
  var i=image("collision-existing");var blob=blobs.findById(MediaBinaryService.sha(i.content)).orElseThrow();blob.byteLength++;blobs.saveAndFlush(blob);
  assertThatThrownBy(()->image("collision-rejected")).hasMessageContaining("Content digest collision");assertThat(images.findById("media-synthetic-collision-rejected")).isEmpty();
 }
 @Test void unauthorizedPrivateRequestsNeverReachObjectStorage()throws Exception{
  var i=image("private","PRIVATE",new byte[]{1,2,3});worker.transferOne();clearInvocations(objects);
  var other=new User(919070L,"synthetic other merchant",Role.AGENT,0);users.save(other);
  try{
   mvc.perform(get("/api/merchant/media/"+i.id)).andExpect(status().isUnauthorized());
   mvc.perform(get("/api/merchant/media/"+i.id).header("Authorization","Bearer "+tokens.createAccessToken(users.findById(1001L).orElseThrow()))).andExpect(status().isForbidden());
   mvc.perform(get("/api/merchant/media/"+i.id).header("Authorization","Bearer "+tokens.createAccessToken(other))).andExpect(status().isNotFound());
   mvc.perform(get("/api/storefront/recommendation-images/"+i.id)).andExpect(status().isNotFound());verifyNoInteractions(objects);
  }finally{users.deleteById(other.getId());}
 }
}
