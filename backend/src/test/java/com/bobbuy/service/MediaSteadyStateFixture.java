package com.bobbuy.service;

import com.bobbuy.model.RecommendationImage;
import com.bobbuy.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.core.env.MapPropertySource;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;

/** Manual, bounded synthetic PG15/RustFS acceptance. Not included in the application jar. */
public final class MediaSteadyStateFixture {
 static final String DB="bobuy_steady_pg15_20261028",RESTORE="bobuy_steady_restore_20261028",PREFIX="steady-synthetic-";
 static final Path STATE=Path.of("/run/steady-state");
 static void require(boolean good,String message){if(!good)throw new AssertionError(message);}
 public static void main(String[] args)throws Exception{
  require("true".equals(System.getenv("BOBUY_SYNTHETIC_RUSTFS_PROBE")),"Synthetic-only guard");String url=System.getenv("SPRING_DATASOURCE_URL");require(Set.of("jdbc:postgresql://postgres:5432/"+DB,"jdbc:postgresql://postgres:5432/"+RESTORE).contains(url),"Owned test database only");require("bobuy-media-test".equals(System.getenv("BOBBUY_MEDIA_RUSTFS_BUCKET")),"Approved private test bucket only");
  var data=new DriverManagerDataSource(url,System.getenv("SPRING_DATASOURCE_USERNAME"),System.getenv("SPRING_DATASOURCE_PASSWORD"));
  try(var c=data.getConnection();var s=c.createStatement();var r=s.executeQuery("show server_version")){r.next();require(r.getString(1).startsWith("15.19"),"PG15.19 required");}
  String phase=args[0];var report=new LinkedHashMap<String,Object>();
  if(phase.equals("prepare")){
   var before=new MediaMigrationAudit(data,null).inspect(false,System.nanoTime()+60_000_000_000L);require(before.mediaRows()==586,"Reuse verified V21 synthetic backup, not a new full benchmark");
   org.flywaydb.core.Flyway.configure().dataSource(data).load().migrate();var after=new MediaMigrationAudit(data,null).inspect(false,System.nanoTime()+60_000_000_000L);require(before.sourceFingerprint().equals(after.sourceFingerprint()),"V22 changed retained source content");require(after.pgRetainedRows()==586&&after.objectOnlyRows()==0,"V22 must preserve all old binaries");report.put("v22ActualFlywayPreserved586PgImages",true);report.put("before",before);report.put("after",after);
  }
  try(var context=new AnnotationConfigApplicationContext()){
   context.getEnvironment().setActiveProfiles("media-migration-command");context.getEnvironment().getPropertySources().addFirst(new MapPropertySource("synthetic-object-mode",Map.of("bobbuy.media.object-only-writes","true","bobbuy.media.prefer-object","true")));
   context.registerBean(javax.sql.DataSource.class,()->data);context.register(MediaMigrationCommand.Configuration.class);context.refresh();
   var binaries=context.getBean(MediaBinaryService.class);var images=context.getBean(RecommendationImageRepository.class);var transfers=context.getBean(MediaTransferRepository.class);var objects=context.getBean(MediaObjectStore.class);var catalog=context.getBean(MediaReferenceCatalog.class);var tx=new TransactionTemplate(context.getBean(PlatformTransactionManager.class));
   if(phase.equals("prepare")){
    byte[] bytes=png(701);Files.write(STATE.resolve("object-only-backup.png"),bytes);var a=binaries.persist(image("a","PUBLIC",bytes));var b=binaries.persist(image("b","PRIVATE",bytes));require(a.content==null&&b.content==null,"New upload unexpectedly stored in PG");binaries.reuse(images.findById(a.id).orElseThrow(),bytes);require(images.findById(a.id).orElseThrow().content==null,"Repeat upload rehydrated PG");require(Arrays.equals(binaries.read(a),bytes),"Real SDK read mismatch");
    require(context.getBean(MediaReferenceRepository.class).findByBlobSha256(a.rawSha256).size()==2,"Shared content reference mismatch");report.put("newUploadsObjectOnlyAndTwoScopesOneHash",true);report.put("hash",a.rawSha256);report.put("bytes",a.byteLength);report.put("actualHibernateV22Validation",true);
   }else if(phase.equals("outage")){
    var old=images.findById("synthetic-00010").orElseThrow();require(Arrays.equals(binaries.read(old),old.content),"Retained PG fallback failed during native RustFS stop");
    expectUnavailable(()->binaries.read(images.findById(PREFIX+"a").orElseThrow()));expectUnavailable(()->binaries.persist(image("rejected","PUBLIC",png(702))));require(!images.existsById(PREFIX+"rejected"),"Failed upload committed unusable metadata");
    var legacy=new MediaBinaryService(images,transfers,objects,catalog,true);tx.execute(status->legacy.persist(image("retry","PRIVATE",png(703))));
    var daemon=new MediaIncrementWorker(context.getBean(MediaTransferWorker.class),1000,1);daemon.start();try{waitFor(()->"RETRY".equals(transfers.findById(PREFIX+"retry").orElseThrow().state),20);}finally{daemon.stop();}require(!daemon.isRunning(),"Worker did not stop");report.put("nativeOutagePgFallbackObjectOnly503NoCommit",true);report.put("daemonFailedAndDurableRetrySurvivedProcessExit",true);report.put("attempts",transfers.findById(PREFIX+"retry").orElseThrow().attempts);
   }else if(phase.equals("recover")){
    var pending=transfers.findById(PREFIX+"retry").orElseThrow();require("RETRY".equals(pending.state)&&pending.attempts>=1,"Previous process retry not durable");
    // Advance only this fixture's retry deadline to avoid a redundant 30-second wait.
    tx.execute(status->{var row=transfers.lock(PREFIX+"retry").orElseThrow();row.leaseUntil=Instant.now().minusSeconds(1);transfers.saveAndFlush(row);return null;});
    var daemon=new MediaIncrementWorker(context.getBean(MediaTransferWorker.class),1000,1);daemon.start();try{waitFor(()->"VERIFIED".equals(transfers.findById(PREFIX+"retry").orElseThrow().state),20);}finally{daemon.stop();}
    int attempts=transfers.findById(PREFIX+"retry").orElseThrow().attempts;require(attempts>=2,"Retry was not reclaimed");var old=images.findById("synthetic-00010").orElseThrow();var pgRead=new MediaBinaryService(images,transfers,objects,catalog,false);require(Arrays.equals(pgRead.read(old),old.content),"Read switch to PG failed");
    var a=images.findById(PREFIX+"a").orElseThrow();byte[] backup=Files.readAllBytes(STATE.resolve("object-only-backup.png"));require(Arrays.equals(binaries.read(a),backup),"Restarted RustFS could not read new image");objects.put(MediaBinaryService.key(a),png(704),a.contentType,a.rawSha256);expectUnavailable(()->binaries.read(a));objects.put(MediaBinaryService.key(a),backup,a.contentType,a.rawSha256);require(Arrays.equals(binaries.read(a),backup),"Object backup restore mismatch");require(catalog.markGcCandidates().isEmpty(),"Retained logical roots unexpectedly became GC candidates");
    report.put("actualDaemonRestartResumedDurableRetry",true);report.put("retryDeadlineAdvancedOnlyForFixture",true);report.put("attempts",attempts);report.put("oldPgReadSwitchAndObjectOnlyBackupRestore",true);report.put("noDeletion",true);
   }else if(phase.equals("restored")){
    require(url.endsWith("/"+RESTORE),"Restore database required");var a=images.findById(PREFIX+"a").orElseThrow();require(a.content==null&&images.findById(PREFIX+"b").orElseThrow().content==null,"PG restore lost object-only residency");require(Arrays.equals(binaries.read(a),Files.readAllBytes(STATE.resolve("object-only-backup.png"))),"Combined metadata/object restore unreadable");require("VERIFIED".equals(transfers.findById(PREFIX+"retry").orElseThrow().state),"Durable transfer state not restored");report.put("v22PgRestoreAndRealObjectRead",true);
   }else if(!phase.equals("prepare"))throw new IllegalArgumentException("Unknown fixture phase");
   report.put("inventory",new MediaMigrationAudit(data,null).inspect(false,System.nanoTime()+60_000_000_000L));report.put("productionChanged",false);report.put("at",Instant.now().toString());Files.writeString(STATE.resolve("fixture-"+phase+".json"),new ObjectMapper().writerWithDefaultPrettyPrinter().writeValueAsString(report));
  }System.out.println("STEADY_SYNTHETIC "+phase+" passed");System.exit(0);
 }
 static RecommendationImage image(String suffix,String scope,byte[] bytes){var i=new RecommendationImage();i.id=PREFIX+suffix;i.merchantId=1000L;i.imageHash=MediaBinaryService.sha(i.id.getBytes(java.nio.charset.StandardCharsets.UTF_8));i.accessScope=scope;i.contentType="image/png";i.content=bytes;return i;}
 static void expectUnavailable(Runnable action){try{action.run();throw new AssertionError("Expected storage unavailable");}catch(org.springframework.web.server.ResponseStatusException expected){require(expected.getStatusCode().value()==503,"Wrong unavailable status");}}
 interface Check{boolean ready();}
 static void waitFor(Check check,int seconds)throws Exception{long end=System.nanoTime()+seconds*1_000_000_000L;while(System.nanoTime()<end){if(check.ready())return;Thread.sleep(200);}throw new AssertionError("Bounded daemon wait expired");}
 static byte[] png(int seed){try{var i=new java.awt.image.BufferedImage(20,20,java.awt.image.BufferedImage.TYPE_INT_RGB);var random=new Random(seed);for(int y=0;y<20;y++)for(int x=0;x<20;x++)i.setRGB(x,y,random.nextInt());var out=new java.io.ByteArrayOutputStream();javax.imageio.ImageIO.write(i,"png",out);return out.toByteArray();}catch(java.io.IOException failure){throw new IllegalStateException("Synthetic PNG failed");}}
}
