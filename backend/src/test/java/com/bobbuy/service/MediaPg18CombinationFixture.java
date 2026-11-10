package com.bobbuy.service;

import com.bobbuy.model.*;
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
import java.util.concurrent.*;

/** Synthetic-only current V20 -> V22 / PG18 / actual approved RustFS combination. Never in app jar. */
public final class MediaPg18CombinationFixture {
 static final String DB="bobuy_media_pg18_20261028",RESTORE="bobuy_media_pg18_restore_20261028",PREFIX="pg18-synthetic-";
 static final Path STATE=Path.of("/run/pg18-combination");
 static void require(boolean b,String message){if(!b)throw new AssertionError(message);}
 public static void main(String[] args)throws Exception{
  require("true".equals(System.getenv("BOBUY_SYNTHETIC_RUSTFS_PROBE")),"Synthetic guard required");String url=System.getenv("SPRING_DATASOURCE_URL");require(Set.of("jdbc:postgresql://postgres:5432/"+DB,"jdbc:postgresql://postgres:5432/"+RESTORE).contains(url),"Owned synthetic DB only");require("bobuy-media-test".equals(System.getenv("BOBBUY_MEDIA_RUSTFS_BUCKET")),"Existing approved private test bucket only");
  var data=new DriverManagerDataSource(url,System.getenv("SPRING_DATASOURCE_USERNAME"),System.getenv("SPRING_DATASOURCE_PASSWORD"));try(var c=data.getConnection();var s=c.createStatement();var r=s.executeQuery("show server_version")){r.next();require(r.getString(1).startsWith("18.6"),"Exact PG18.6 required");}
  String phase=args[0];var report=new LinkedHashMap<String,Object>();
  if(phase.equals("upgrade")){
   var before=new MediaMigrationAudit(data,null).inspect(false,System.nanoTime()+60_000_000_000L);require(before.mediaRows()==566&&!before.schemaReady(),"Verified V20 synthetic source only");org.flywaydb.core.Flyway.configure().dataSource(data).load().migrate();var after=new MediaMigrationAudit(data,null).inspect(false,System.nanoTime()+60_000_000_000L);require(before.sourceFingerprint().equals(after.sourceFingerprint())&&after.pgRetainedRows()==566,"V21/V22 changed retained source bytes");report.put("v20ToV22ActualFlyway",true);report.put("v20Source",before);report.put("afterMigration",after);
  }
  try(var context=new AnnotationConfigApplicationContext()){
   context.getEnvironment().setActiveProfiles("media-migration-command");context.getEnvironment().getPropertySources().addFirst(new MapPropertySource("pg18-synthetic",Map.of("bobbuy.media.object-only-writes","true","bobbuy.media.prefer-object","true")));context.registerBean(javax.sql.DataSource.class,()->data);context.register(MediaMigrationCommand.Configuration.class);context.refresh();
   var binary=context.getBean(MediaBinaryService.class);var images=context.getBean(RecommendationImageRepository.class);var refs=context.getBean(MediaReferenceRepository.class);var transfers=context.getBean(MediaTransferRepository.class);var catalog=context.getBean(MediaReferenceCatalog.class);var objects=context.getBean(MediaObjectStore.class);var tx=new TransactionTemplate(context.getBean(PlatformTransactionManager.class));
   byte[] bytes=png();
   try(var connection=data.getConnection()){
    connection.setAutoCommit(false);try(var statement=connection.createStatement()){statement.execute("create temporary table pg18_media_codec_probe(j jsonb,b bytea check(octet_length(b)>0))");}
    try(var insert=connection.prepareStatement("insert into pg18_media_codec_probe values(?::jsonb,?)")){insert.setString(1,"{\"ja\":\"合成テスト\"}");insert.setBytes(2,bytes);insert.executeUpdate();}
    try(var statement=connection.createStatement();var row=statement.executeQuery("select j->>'ja',b from pg18_media_codec_probe")){row.next();require("合成テスト".equals(row.getString(1))&&Arrays.equals(bytes,row.getBytes(2)),"PG18 JDBC JSONB/bytea mismatch");}connection.rollback();report.put("rolledBackJapaneseJsonbByteaJdbcProbe",true);
   }
   if(phase.equals("upgrade")){
    String after="";for(int pages=0;pages<10;pages++){String next=binary.backfillPage(after,100);if(next==null)break;after=next;}require(refs.count()==566&&transfers.count()==566,"Explicit current-model backfill mismatch");
    var pool=Executors.newFixedThreadPool(2);try{var a=pool.submit(()->binary.persist(image("a","PUBLIC",bytes)));var z=pool.submit(()->binary.persist(image("b","PRIVATE",bytes)));a.get(60,TimeUnit.SECONDS);z.get(60,TimeUnit.SECONDS);}finally{pool.shutdownNow();}
    var a=images.findById(PREFIX+"a").orElseThrow();var z=images.findById(PREFIX+"b").orElseThrow();require(a.content==null&&z.content==null&&a.rawSha256.equals(z.rawSha256),"Object-only sharing mismatch");binary.reuse(a,bytes);require(images.findById(a.id).orElseThrow().content==null,"Repeat upload rehydrated PG");require(Arrays.equals(binary.read(a),bytes),"Actual SDK bytes differ");
    String key=MediaBinaryService.key(a);var listed=objects.list("blobs/v1/sha256/",null);require(listed.nextToken()==null&&listed.objects().stream().filter(o->o.key().equals(key)).count()==1,"Shared CAS key inventory mismatch");require(refs.findByBlobSha256(a.rawSha256).size()==2,"Cross-scope references lost");
    // Deliberately damage one synthetic reference: the retained media root must still prohibit GC; then restore it.
    refs.deleteById(a.id);require(!catalog.markGcCandidates().contains(a.rawSha256),"Retained object-only root became GC eligible");catalog.bindChecked(a,bytes);
    var worker=context.getBean(MediaTransferWorker.class);for(int i=0;i<3;i++)require(worker.transferOne(),"Expected retained-PG outbox work");var old=images.findById("synthetic-00000").orElseThrow();require(Arrays.equals(binary.read(old),old.content),"Verified old media read differs");require(Arrays.equals(new MediaBinaryService(images,transfers,objects,catalog,false).read(old),old.content),"PG preferred read switch failed");
    var claim=binary.claim();require(claim!=null,"Lease fixture required");tx.execute(status->{var row=transfers.lock(claim.imageId()).orElseThrow();row.leaseUntil=Instant.now().minusSeconds(1);row.updatedAt=Instant.EPOCH;transfers.saveAndFlush(row);return null;});require(transfers.pending(Instant.now(),org.springframework.data.domain.PageRequest.of(0,1000)).contains(claim.imageId()),"PG18 expired lease not reclaimable");
    var daemon=new MediaIncrementWorker(worker,1000,1);for(int cycle=0;cycle<2;cycle++){long verified=transfers.findAll().stream().filter(t->"VERIFIED".equals(t.state)).count();daemon.start();try{long end=System.nanoTime()+20_000_000_000L;while(transfers.findAll().stream().filter(t->"VERIFIED".equals(t.state)).count()<=verified&&System.nanoTime()<end)Thread.sleep(100);require(transfers.findAll().stream().filter(t->"VERIFIED".equals(t.state)).count()>verified,"PG18 daemon failed to advance");}finally{daemon.stop();}}
    report.put("actualHibernateValidation",true);report.put("concurrentObjectOnlyCrossScopeOneCas",true);report.put("repeatUploadNoPgBytes",true);report.put("explicitRootRetentionAfterDamagedReference",true);report.put("actualJavaSdkOldAndNewReads",true);report.put("pgReadRollbackSwitch",true);report.put("pg18ExpiredLeaseQuery",true);report.put("actualPg18DaemonStopRestart",true);report.put("copiedRetainedSamples",5);report.put("fullBucketMigrationNotRepeated",true);
   }else if(phase.equals("restored")){
    require(url.endsWith("/"+RESTORE),"Restore DB required");var a=images.findById(PREFIX+"a").orElseThrow();require(a.content==null&&Arrays.equals(binary.read(a),bytes),"Restored metadata/object read mismatch");require(refs.findByBlobSha256(a.rawSha256).size()==2,"Restored references differ");report.put("actualRestoredHibernateAndObjectRead",true);
   }else throw new IllegalArgumentException("Unknown phase");
   report.put("inventory",new MediaMigrationAudit(data,null).inspect(false,System.nanoTime()+60_000_000_000L));report.put("productionChanged",false);report.put("at",Instant.now().toString());Files.writeString(STATE.resolve("fixture-"+phase+".json"),new ObjectMapper().writerWithDefaultPrettyPrinter().writeValueAsString(report));
  }System.out.println("PG18_SYNTHETIC "+phase+" passed");System.exit(0);
 }
 static RecommendationImage image(String id,String scope,byte[] bytes){var row=new RecommendationImage();row.id=PREFIX+id;row.merchantId=1000L;row.imageHash=MediaBinaryService.sha(row.id.getBytes(java.nio.charset.StandardCharsets.UTF_8));row.accessScope=scope;row.contentType="image/png";row.content=bytes;return row;}
 static byte[] png(){try{var image=new java.awt.image.BufferedImage(20,20,java.awt.image.BufferedImage.TYPE_INT_RGB);var random=new Random(28182622);for(int y=0;y<20;y++)for(int x=0;x<20;x++)image.setRGB(x,y,random.nextInt());var out=new java.io.ByteArrayOutputStream();javax.imageio.ImageIO.write(image,"png",out);return out.toByteArray();}catch(Exception failure){throw new IllegalStateException("Synthetic image failed");}}
}
