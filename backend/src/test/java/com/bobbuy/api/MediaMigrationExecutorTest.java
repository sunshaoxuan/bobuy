package com.bobbuy.api;

import com.bobbuy.service.*;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import javax.sql.DataSource;
import java.nio.file.*;
import java.nio.channels.FileChannel;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Disposable H2 + fake object store; these are not live RustFS/PG15 evidence. */
@SpringBootTest(properties={"bobbuy.media.prefer-object=true","bobbuy.security.header-auth.enabled=false"})
class MediaMigrationExecutorTest {
 @Autowired MediaMigrationExecutor executor;@Autowired MediaBinaryService binaries;@Autowired RecommendationImageRepository images;@Autowired MediaTransferRepository transfers;@Autowired MediaReferenceRepository refs;@Autowired MediaBlobRepository blobs;@Autowired BobbuyStore store;@Autowired DataSource data;
 @MockBean MediaObjectStore objects;@TempDir Path directory;
 final Map<String,MediaObjectStore.ObjectData> copied=new ConcurrentHashMap<>();String prefix;Runnable onRead;
 @BeforeEach void setup(){store.seed();prefix="migration-"+UUID.randomUUID()+"-";reset(objects);copied.clear();onRead=null;
  doAnswer(call->{copied.put(call.getArgument(0),new MediaObjectStore.ObjectData(((byte[])call.getArgument(1)).clone(),call.getArgument(2),Map.of("raw-sha256",call.getArgument(3))));return null;}).when(objects).put(anyString(),any(),anyString(),anyString());
  when(objects.get(anyString())).thenAnswer(call->{if(onRead!=null){var callback=onRead;onRead=null;callback.run();}var found=copied.get(call.getArgument(0));if(found==null)throw new MediaObjectStore.Missing();return found;});
  when(objects.list(anyString(),nullable(String.class))).thenAnswer(call->{var all=copied.entrySet().stream().sorted(Map.Entry.comparingByKey()).toList();int offset=call.getArgument(1)==null?0:Integer.parseInt(call.getArgument(1));var page=all.stream().skip(offset).limit(2).map(e->new MediaObjectStore.ListedObject(e.getKey(),e.getValue().bytes().length)).toList();return new MediaObjectStore.ObjectPage(page,offset+page.size()<all.size()?String.valueOf(offset+page.size()):null);});
 }
 @AfterEach void cleanup(){for(var image:images.findAll().stream().filter(i->i.id.startsWith(prefix)).toList()){transfers.deleteById(image.id);refs.deleteById(image.id);images.deleteById(image.id);}for(var blob:blobs.findAll())if(!refs.existsByBlobSha256(blob.sha256)&&!transfers.existsByRawSha256(blob.sha256))blobs.deleteById(blob.sha256);}
 RecommendationImage image(String suffix,byte... content){var row=new RecommendationImage();row.id=prefix+suffix;row.merchantId=1000L;row.accessScope="PUBLIC";row.contentType="image/png";row.content=content;row.imageHash=MediaBinaryService.sha(row.id.getBytes());return images.saveAndFlush(row);}
 MediaMigrationExecutor.Options options(MediaMigrationExecutor.Mode mode,int pages,int count){return new MediaMigrationExecutor.Options(mode,directory.resolve("checkpoint.json"),directory.resolve("report.json"),1,pages,count,2,30,"synthetic-target");}
 @Test void dryRunNeverEnqueuesOrContactsObjectStore()throws Exception{
  image("a",(byte)1,(byte)2);image("b",(byte)1,(byte)2);var before=transfers.count();var result=executor.run(options(MediaMigrationExecutor.Mode.DRY_RUN,10,10));
  assertThat(result.readOnly()).isTrue();assertThat(result.audit().mediaRows()).isEqualTo(2);assertThat(result.audit().uniqueBlobs()).isEqualTo(1);assertThat(result.audit().sharedBytes()).isEqualTo(2);assertThat(transfers.count()).isEqualTo(before);assertThat(Files.exists(directory.resolve("checkpoint.json"))).isFalse();verifyNoInteractions(objects);
 }
 @Test void boundedCheckpointResumesAndIncludesLowerIdIncrementWithoutRepeatingWrites()throws Exception{
  image("a",(byte)1,(byte)2);image("b",(byte)1,(byte)2);image("c",(byte)3,(byte)4);
  var first=executor.run(options(MediaMigrationExecutor.Mode.TRANSFER,1,1));assertThat(first.status()).isEqualTo("INCOMPLETE");assertThat(first.scanComplete()).isFalse();
  var lower=image("0-increment",(byte)9,(byte)9);binaries.persist(lower);
  String extraHash=MediaBinaryService.sha(new byte[]{6});copied.put("blobs/v1/sha256/"+extraHash.substring(0,2)+"/"+extraHash,new MediaObjectStore.ObjectData(new byte[]{6},"image/png",Map.of("raw-sha256",extraHash)));
  var completed=executor.run(options(MediaMigrationExecutor.Mode.TRANSFER,20,100));assertThat(completed.status()).isEqualTo("VERIFIED");assertThat(completed.audit().mediaRows()).isEqualTo(4);assertThat(completed.audit().uniqueBlobs()).isEqualTo(3);assertThat(completed.audit().extraObjects()).isEqualTo(1);assertThat(copied).hasSize(4);
  clearInvocations(objects);var replay=executor.run(options(MediaMigrationExecutor.Mode.TRANSFER,20,100));assertThat(replay.status()).isEqualTo("VERIFIED");assertThat(replay.transfersAttempted()).isZero();verify(objects,never()).put(anyString(),any(),anyString(),anyString());
 }
 @Test void independentVerifyDetectsCorruptionAndDoesNotRewriteIt()throws Exception{
  var row=image("a",(byte)1,(byte)2);executor.run(options(MediaMigrationExecutor.Mode.TRANSFER,10,10));var key=MediaBinaryService.key(row);copied.put(key,new MediaObjectStore.ObjectData(new byte[]{7,8},"image/png",Map.of("raw-sha256",MediaBinaryService.sha(row.content))));clearInvocations(objects);
  var result=executor.run(options(MediaMigrationExecutor.Mode.VERIFY,10,10));assertThat(result.readOnly()).isTrue();assertThat(result.status()).isEqualTo("INCOMPLETE");assertThat(result.audit().objectErrors()).isPositive();verify(objects,never()).put(anyString(),any(),anyString(),anyString());assertThat(images.findById(row.id).orElseThrow().content).containsExactly(1,2);
 }
 @Test void concurrentSourceChangePreventsAFalseVerifiedReport()throws Exception{
  var row=image("a",(byte)1,(byte)2);executor.run(options(MediaMigrationExecutor.Mode.TRANSFER,10,10));onRead=()->{row.content=new byte[]{4,5};binaries.persist(row);};
  var result=executor.run(options(MediaMigrationExecutor.Mode.VERIFY,10,10));assertThat(result.audit().sourceStable()).isFalse();assertThat(result.status()).isEqualTo("INCOMPLETE");
  assertThat(executor.run(options(MediaMigrationExecutor.Mode.TRANSFER,10,10)).status()).isEqualTo("VERIFIED");
 }
 @Test void sourceTargetMismatchAndHeldCheckpointLockStopWithoutChangingCheckpoint()throws Exception{
  image("a",(byte)1);executor.run(options(MediaMigrationExecutor.Mode.TRANSFER,10,10));var path=directory.resolve("checkpoint.json");byte[] before=Files.readAllBytes(path);var changed=new MediaMigrationExecutor.Options(MediaMigrationExecutor.Mode.TRANSFER,path,directory.resolve("report.json"),1,10,10,1,30,"another-target");
  assertThatThrownBy(()->executor.run(changed)).hasMessageContaining("another source");assertThat(Files.readAllBytes(path)).isEqualTo(before);
  byte[] reportBefore=Files.readAllBytes(directory.resolve("report.json"));try(var channel=FileChannel.open(directory.resolve("checkpoint.json.lock"),StandardOpenOption.WRITE);var lock=channel.lock()){assertThatThrownBy(()->executor.run(options(MediaMigrationExecutor.Mode.TRANSFER,10,10))).isInstanceOf(java.nio.channels.OverlappingFileLockException.class);}
  assertThat(Files.readAllBytes(path)).isEqualTo(before);assertThat(Files.readAllBytes(directory.resolve("report.json"))).isEqualTo(reportBefore);
 }
 @Test void reportCannotOverwriteCheckpointOrUnrelatedOperatorFiles()throws Exception{
  Path report=directory.resolve("report.json");Files.writeString(report,"operator unrelated data");assertThatThrownBy(()->executor.run(options(MediaMigrationExecutor.Mode.DRY_RUN,10,10))).isInstanceOf(Exception.class);assertThat(Files.readString(report)).isEqualTo("operator unrelated data");
  var invalid=new MediaMigrationExecutor.Options(MediaMigrationExecutor.Mode.TRANSFER,report,report,1,1,1,1,30,"target");assertThatThrownBy(()->executor.run(invalid)).hasMessageContaining("must differ");assertThat(Files.readString(report)).isEqualTo("operator unrelated data");
 }
}
