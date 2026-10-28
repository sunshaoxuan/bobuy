package com.bobbuy.api;

import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.service.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import javax.sql.DataSource;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Synthetic H2/fake adapter only; live SDK evidence is reported separately. */
@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:objectonly;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE","bobbuy.media.prefer-object=true","bobbuy.media.object-only-writes=true"})
class MediaObjectOnlyIntegrationTest {
 @Autowired MediaBinaryService binaries;@Autowired RecommendationImageRepository images;@Autowired MediaTransferRepository transfers;
 @Autowired MediaReferenceRepository refs;@Autowired MediaBlobRepository blobs;@Autowired MediaReferenceCatalog catalog;@Autowired PlatformTransactionManager transactions;@Autowired DataSource data;
 @MockBean MediaObjectStore objects;
 final Map<String,MediaObjectStore.ObjectData> copied=new ConcurrentHashMap<>();
 @BeforeEach void setup(){transfers.deleteAll();refs.deleteAll();blobs.deleteAll();images.deleteAll();reset(objects);copied.clear();
  doAnswer(call->{copied.put(call.getArgument(0),new MediaObjectStore.ObjectData(((byte[])call.getArgument(1)).clone(),call.getArgument(2),Map.of("raw-sha256",call.getArgument(3))));return null;}).when(objects).put(anyString(),any(),anyString(),anyString());
  when(objects.get(anyString())).thenAnswer(call->{var value=copied.get(call.getArgument(0));if(value==null)throw new MediaObjectStore.Missing();return value;});
  when(objects.list(anyString(),nullable(String.class))).thenAnswer(call->new MediaObjectStore.ObjectPage(copied.entrySet().stream().map(e->new MediaObjectStore.ListedObject(e.getKey(),e.getValue().bytes().length)).toList(),null));
 }
 RecommendationImage input(String id,String scope){var row=new RecommendationImage();row.id="objectonly-"+id;row.merchantId=1000L;row.imageHash=MediaBinaryService.sha(id.getBytes());row.contentType="image/png";row.accessScope=scope;row.content=new byte[]{4,5,6};return row;}
 @Test void newUploadsHaveOnlyMetadataInPgAndShareAcrossPathsAndScopes()throws Exception{
  var a=binaries.persist(input("a","PUBLIC"));var b=binaries.persist(input("b","PRIVATE"));
  assertThat(images.findById(a.id).orElseThrow().content).isNull();assertThat(a.rawSha256).isEqualTo(MediaBinaryService.sha(new byte[]{4,5,6}));assertThat(a.byteLength).isEqualTo(3);assertThat(refs.count()).isEqualTo(2);assertThat(blobs.count()).isEqualTo(1);assertThat(copied).hasSize(1);verify(objects,times(1)).put(anyString(),any(),anyString(),anyString());assertThat(binaries.read(a)).containsExactly(4,5,6);
  var audit=new MediaMigrationAudit(data,objects).inspect(true,System.nanoTime()+TimeUnit.SECONDS.toNanos(5));assertThat(audit.complete()).isTrue();assertThat(audit.objectOnlyRows()).isEqualTo(2);assertThat(audit.pgRetainedBytes()).isZero();assertThat(audit.sharedBytes()).isEqualTo(3);
 }
 @Test void repeatUploadAndCursorReplayNeverRehydrateOrDuplicate(){
  var a=binaries.persist(input("repeat","PUBLIC"));binaries.reuse(images.findById(a.id).orElseThrow(),new byte[]{4,5,6});binaries.backfillPage("",100);
  assertThat(images.count()).isEqualTo(1);assertThat(images.findById(a.id).orElseThrow().content).isNull();assertThat(transfers.findById(a.id).orElseThrow().state).isEqualTo("VERIFIED");verify(objects,times(1)).put(anyString(),any(),anyString(),anyString());
 }
 @Test void existingPgCopyIsPreservedAndReadSwitchCanReturnToPg(){
  var old=images.saveAndFlush(input("retained","PUBLIC"));binaries.reuse(old,new byte[]{4,5,6});assertThat(images.findById(old.id).orElseThrow().content).containsExactly(4,5,6);
  copied.clear();assertThat(binaries.read(old)).containsExactly(4,5,6);var pgPreferred=new MediaBinaryService(images,transfers,objects,catalog,false);clearInvocations(objects);assertThat(pgPreferred.read(old)).containsExactly(4,5,6);verifyNoInteractions(objects);
 }
 @Test void objectOnlyMissingOrCorruptObjectFailsClosedWithoutInventedPgFallback(){
  var row=binaries.persist(input("missing","PRIVATE"));copied.clear();assertThatThrownBy(()->binaries.read(row)).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
  copied.put(MediaBinaryService.key(row),new MediaObjectStore.ObjectData(new byte[]{1,2,3},"image/png",Map.of("raw-sha256",row.rawSha256)));assertThatThrownBy(()->binaries.read(row)).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);assertThat(images.findById(row.id).orElseThrow().content).isNull();
 }
 @Test void failedUploadDoesNotCommitAndLostResponseCanRetrySameKey(){
  doAnswer(call->{copied.put(call.getArgument(0),new MediaObjectStore.ObjectData(((byte[])call.getArgument(1)).clone(),call.getArgument(2),Map.of("raw-sha256",call.getArgument(3))));throw new IllegalStateException("synthetic response loss");}).when(objects).put(anyString(),any(),anyString(),anyString());
  assertThatThrownBy(()->binaries.persist(input("retry","PUBLIC"))).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);assertThat(images.count()).isZero();assertThat(transfers.count()).isZero();
  var saved=binaries.persist(input("retry","PUBLIC"));assertThat(saved.content).isNull();verify(objects,times(1)).put(anyString(),any(),anyString(),anyString());
 }
 @Test void rollbackRetainsSafeOrphanAndNeverDeletesObjects(){
  assertThatThrownBy(()->new TransactionTemplate(transactions).execute(status->{binaries.persist(input("rollback","PUBLIC"));throw new IllegalStateException("synthetic rollback");})).isInstanceOf(IllegalStateException.class);assertThat(images.count()).isZero();assertThat(refs.count()).isZero();assertThat(copied).hasSize(1);assertThat(catalog.reviewGcCandidates()).isEmpty();
 }
 @Test void concurrentUploadsAndRestorableLogicalReferencesRetainOneObject()throws Exception{
  var pool=Executors.newFixedThreadPool(2);try{var a=pool.submit(()->binaries.persist(input("parallel-a","PUBLIC")));var b=pool.submit(()->binaries.persist(input("parallel-b","PRIVATE")));a.get(10,TimeUnit.SECONDS);b.get(10,TimeUnit.SECONDS);}finally{pool.shutdownNow();}
  assertThat(blobs.count()).isEqualTo(1);assertThat(refs.count()).isEqualTo(2);verify(objects,times(1)).put(anyString(),any(),anyString(),anyString());
  // Logical deletion does not unlink either media record; even a damaged explicit ref is protected by the retained root.
  refs.deleteAll();assertThat(catalog.markGcCandidates()).isEmpty();assertThat(copied).hasSize(1);
 }
 @Test void existingIdentityCannotBeOverwrittenAndCorruptCasCannotBeReplaced(){
  var row=binaries.persist(input("immutable","PUBLIC"));assertThatThrownBy(()->binaries.reuse(row,new byte[]{9})).isInstanceOf(IllegalArgumentException.class);
  copied.put(MediaBinaryService.key(row),new MediaObjectStore.ObjectData(new byte[]{9},"image/png",Map.of("raw-sha256",row.rawSha256)));clearInvocations(objects);assertThatThrownBy(()->binaries.persist(input("collision","PUBLIC"))).isInstanceOf(org.springframework.web.server.ResponseStatusException.class);assertThat(images.count()).isEqualTo(1);verify(objects,never()).put(anyString(),any(),anyString(),anyString());
 }
 @Test void controllerMapsUnavailableTo503WithoutLeakingAdapterDetails()throws Exception{
  var row=binaries.persist(input("http","PRIVATE"));doThrow(new IllegalStateException("synthetic-sensitive-adapter-details")).when(objects).get(anyString());
  var authorizedStorage=mock(ImageStorageService.class);when(authorizedStorage.privateImage(row.id)).thenReturn(row);
  var messages=new org.springframework.context.support.StaticMessageSource();messages.addMessage("error.internal",Locale.ENGLISH,"Request failed");
  var mvc=org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(new StoredMediaController(authorizedStorage,binaries)).setControllerAdvice(new com.bobbuy.api.response.GlobalExceptionHandler(messages)).build();
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/merchant/media/"+row.id).locale(Locale.ENGLISH)).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isServiceUnavailable()).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("synthetic-sensitive"))));
 }
}
