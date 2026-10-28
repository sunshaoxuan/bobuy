package com.bobbuy.service;

import com.bobbuy.api.BobbuyApplication;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.security.JwtTokenService;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.net.URI;
import java.net.http.*;

/** Explicit opt-in synthetic-only probe, run in the existing local backend container.
 * Not a JUnit test, public endpoint, scheduled task, production importer or deployed jar class. */
public class RustFsLiveProbe {
 private static final Map<String,Object> results=new LinkedHashMap<>();
 private static void require(boolean value,String label){if(!value)throw new AssertionError(label);}
 public static void main(String[] ignored)throws Exception{
  require("true".equals(System.getenv("BOBUY_SYNTHETIC_RUSTFS_PROBE")),"Explicit synthetic test guard required");
  require("https://rustfs:9000".equals(System.getenv("BOBBUY_MEDIA_RUSTFS_ENDPOINT")),"Only approved local endpoint permitted");
  require("bobuy-media-test".equals(System.getenv("BOBBUY_MEDIA_RUSTFS_BUCKET")),"Only approved synthetic bucket permitted");
  ConfigurableApplicationContext context=null;int exit=1;
  try{
   context=SpringApplication.run(BobbuyApplication.class,"--bobbuy.seed.enabled=false","--spring.jpa.hibernate.ddl-auto=validate","--server.port=8080");
   run(context);results.put("pass",true);exit=0;
  }catch(Throwable error){results.put("pass",false);results.put("errorType",error.getClass().getSimpleName());results.put("reason",error instanceof AssertionError?error.getMessage():"Application/probe failed; inspect sanitized local log");}
  finally{if(context!=null)context.close();var text=new ObjectMapper().writeValueAsString(results);Files.writeString(Path.of("/tmp/rustfs-java-result.json"),text);System.out.println("BOBUY_RUSTFS_LIVE_RESULT="+text);}
  System.exit(exit);
 }
 private static void run(ConfigurableApplicationContext context)throws Exception{
  var binaries=context.getBean(MediaBinaryService.class);var worker=context.getBean(MediaTransferWorker.class);var objects=context.getBean(RustFsObjectStore.class);
  var images=context.getBean(RecommendationImageRepository.class);var transfers=context.getBean(MediaTransferRepository.class);var refs=context.getBean(MediaReferenceRepository.class);var blobs=context.getBean(MediaBlobRepository.class);var catalog=context.getBean(MediaReferenceCatalog.class);
  var jdbc=context.getBean(JdbcTemplate.class);var products=context.getBean(ProductRepository.class);var users=context.getBean(UserRepository.class);var tokens=context.getBean(JwtTokenService.class);
  var tx=new TransactionTemplate(context.getBean(PlatformTransactionManager.class));
  require("21".equals(jdbc.queryForObject("select version from flyway_schema_history where success order by installed_rank desc limit 1",String.class)),"Actual Flyway V21 startup");results.put("actualFlywayV21Startup",true);
  String prefix="zz-rustfs-live-"+UUID.randomUUID()+"-",productId=prefix+"product";var created=ConcurrentHashMap.<String>newKeySet();var hashes=ConcurrentHashMap.<String>newKeySet();
  byte[] bytes=png(prefix);
  java.util.function.BiFunction<String,String,RecommendationImage> save=(suffix,scope)->{var image=new RecommendationImage();image.id=prefix+suffix;image.merchantId=1000L;image.imageHash=MediaBinaryService.sha((image.id+scope).getBytes(java.nio.charset.StandardCharsets.UTF_8));image.accessScope=scope;image.contentType="image/png";image.content=bytes.clone();created.add(image.id);hashes.add(MediaBinaryService.sha(image.content));return binaries.persist(image);};
  var pool=Executors.newFixedThreadPool(2);
  try{
   require(users.findById(1000L).isPresent()&&users.findById(1001L).isPresent(),"Existing synthetic fixture accounts required");
   long before=transfers.count();
   var latch=new CountDownLatch(1);var pa=pool.submit(()->{latch.await();return save.apply("public","PUBLIC");});var pb=pool.submit(()->{latch.await();return save.apply("private","PRIVATE");});latch.countDown();var a=pa.get(20,TimeUnit.SECONDS);var b=pb.get(20,TimeUnit.SECONDS);String hash=MediaBinaryService.sha(bytes),key=MediaBinaryService.key(a);
   require(refs.findById(a.id).orElseThrow().blobSha256.equals(refs.findById(b.id).orElseThrow().blobSha256),"Cross-path shared hash binding");require(refs.findByBlobSha256(hash).size()==2,"Concurrent reference preservation");results.put("pgConcurrentBindingsAndSharedHash",true);
   var wa=pool.submit(worker::transferOne);var wb=pool.submit(worker::transferOne);require(wa.get(40,TimeUnit.SECONDS)&&wb.get(40,TimeUnit.SECONDS),"Both concurrent transfers claimed");
   require("VERIFIED".equals(transfers.findById(a.id).orElseThrow().state)&&"VERIFIED".equals(transfers.findById(b.id).orElseThrow().state),"Real Java SDK uploads verified");
   require(Arrays.equals(objects.get(key).bytes(),bytes),"Real Java SDK read bytes");require(Arrays.equals(binaries.read(a),bytes),"Preferred application object read");results.put("realSdkConcurrentOutboxVerified",true);
   var beforeBackfill=transfers.count();binaries.backfillPage(prefix,100);binaries.backfillPage(prefix,100);require(transfers.count()==beforeBackfill,"Scoped backfill idempotence");results.put("idempotentScopedBackfill",true);
   require(Arrays.equals(images.findById(a.id).orElseThrow().content,bytes),"PG bytes retained after transfer");
   try{tx.execute(status->{save.apply("rollback","PUBLIC");throw new IllegalStateException("synthetic rollback");});throw new AssertionError("Expected rollback");}catch(IllegalStateException expected){}
   require(!images.existsById(prefix+"rollback")&&!transfers.existsById(prefix+"rollback")&&!refs.existsById(prefix+"rollback"),"PG/outbox/reference rollback atomicity");results.put("realPgTransactionRollback",true);
   var p=new Product();p.setId(productId);p.setMerchantId(1000L);p.setName(new HashMap<>(Map.of("ja-JP","Synthetic RustFS lifecycle")));p.setVisibilityStatus(ProductVisibility.DRAFTER_ONLY);p.setMediaGallery(new ArrayList<>(List.of(new MediaGalleryItem("/api/storefront/recommendation-images/"+a.id,MediaType.IMAGE,Map.of("ja-JP","Synthetic")))));products.saveAndFlush(p);
   String admin=tokens.createAccessToken(users.findById(1000L).orElseThrow()),customer=tokens.createAccessToken(users.findById(1001L).orElseThrow());
   require(http("GET","/api/merchant/media/"+b.id,null,null)==401,"Private anonymous denied");require(http("GET","/api/merchant/media/"+b.id,customer,null)==403,"Private customer denied");require(http("GET","/api/storefront/recommendation-images/"+b.id,null,null)==404,"Private hash not exposed publicly");results.put("actualHttpPrivateIsolation",true);
   require(http("DELETE","/api/mobile/products/"+productId,admin,null)==200,"Normal lifecycle delete");
   require(jdbc.queryForObject("select deleted_at is not null from bb_product where id=?",Boolean.class,productId),"Logical delete persisted");require(refs.existsById(a.id)&&images.existsById(a.id)&&!catalog.markGcCandidates().contains(hash),"Logical delete retains media root");
   require(http("GET","/api/storefront/recommendation-images/"+a.id,null,null)==404,"Deleted product media hidden");
   Long version=jdbc.queryForObject("select record_version from bb_product where id=?",Long.class,productId);
   require(http("POST","/api/admin/products/trash/restore",admin,new ObjectMapper().writeValueAsString(Map.of("id",productId,"version",version)))==200,"Normal admin restore");
   require(products.existsById(productId)&&Arrays.equals(binaries.read(a),bytes),"Restored product bytes retained");results.put("logicalDeleteRestoreRetainsSharedObject",true);
   objects.put(key,new byte[]{1,2,3},"image/png",hash);require(Arrays.equals(binaries.read(a),bytes),"Real corrupt S3 payload falls back to PG");objects.put(key,bytes,"image/png",hash);require(Arrays.equals(objects.get(key).bytes(),bytes)&&Arrays.equals(binaries.read(a),bytes),"Corruption repaired and preferred read recovered");results.put("realObjectCorruptionPgFallbackAndRecovery",true);
   var broken=new MediaObjectStore(){public void put(String k,byte[]v,String t,String h){throw new IllegalStateException("synthetic adapter outage");}public ObjectData get(String k){throw new IllegalStateException("synthetic adapter outage");}};
   require(Arrays.equals(new MediaBinaryService(images,transfers,broken,catalog,true).read(a),bytes),"Adapter outage PG fallback");results.put("injectedAdapterOutageFallback",true);
   var lost=save.apply("lost-response","PUBLIC");lost.content=png(prefix+"lost");hashes.add(MediaBinaryService.sha(lost.content));binaries.persist(lost);var putCount=new AtomicInteger();
   var loseResponse=new MediaObjectStore(){public void put(String k,byte[]v,String t,String h){objects.put(k,v,t,h);putCount.incrementAndGet();throw new IllegalStateException("synthetic response loss after real PUT");}public ObjectData get(String k){return objects.get(k);}};
   require(new MediaTransferWorker(binaries,loseResponse).transferOne(),"Lost response transfer claimed");require("RETRY".equals(transfers.findById(lost.id).orElseThrow().state),"Lost response retries safely");var row=transfers.findById(lost.id).orElseThrow();row.leaseUntil=Instant.now().minusSeconds(1);transfers.saveAndFlush(row);
   require(new MediaTransferWorker(binaries,loseResponse).transferOne(),"Lost response retry claimed");require("VERIFIED".equals(transfers.findById(lost.id).orElseThrow().state)&&putCount.get()==1,"Retry reused actual object without second PUT");results.put("realPutResponseLossIdempotentRecovery",true);
   results.put("physicalCasKeysForSharedPair",1);results.put("sharedRetentionReferences",refs.findByBlobSha256(hash).size());results.put("preexistingTransferRows",before);
  }finally{
   pool.shutdownNow();
   jdbc.update("delete from bb_product_lifecycle_event where product_id=?",productId);jdbc.update("delete from bb_product where id=?",productId);
   for(String id:created){transfers.deleteById(id);refs.deleteById(id);images.deleteById(id);}
   for(String hash:hashes)if(!refs.existsByBlobSha256(hash)&&!transfers.existsByRawSha256(hash))blobs.deleteById(hash);
   results.put("syntheticDatabaseRowsCleaned",created.stream().noneMatch(images::existsById));
  }
 }
 private static byte[] png(String seed)throws Exception{
  var image=new java.awt.image.BufferedImage(16,16,java.awt.image.BufferedImage.TYPE_INT_RGB);var random=new Random(seed.hashCode());for(int y=0;y<16;y++)for(int x=0;x<16;x++)image.setRGB(x,y,random.nextInt());var output=new java.io.ByteArrayOutputStream();javax.imageio.ImageIO.write(image,"png",output);return output.toByteArray();
 }
 private static int http(String method,String path,String token,String body)throws Exception{
  var request=HttpRequest.newBuilder(URI.create("http://127.0.0.1:8080"+path)).timeout(java.time.Duration.ofSeconds(15));if(token!=null)request.header("Authorization","Bearer "+token);if(body!=null)request.header("Content-Type","application/json");request.method(method,body==null?HttpRequest.BodyPublishers.noBody():HttpRequest.BodyPublishers.ofString(body));return HttpClient.newHttpClient().send(request.build(),HttpResponse.BodyHandlers.discarding()).statusCode();
 }
}
