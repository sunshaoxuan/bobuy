package com.bobbuy.api;

import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.security.JwtTokenService;
import com.bobbuy.service.*;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import java.util.*;
import java.util.concurrent.*;
import java.time.Instant;
import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.mock.web.MockMultipartFile;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Dedicated synthetic cloud DB only. Real Postgres row locks, JSON, HTTP authorization and rollback. */
@EnabledIfEnvironmentVariable(named="BOBBUY_PHOTO_ISOLATED_TEST",matches="true")
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.DEFINED_PORT,properties={"server.port=${BOBBUY_PHOTO_TEST_HTTP_PORT:18080}","spring.datasource.url=jdbc:postgresql://127.0.0.1:${BOBBUY_PHOTO_TEST_DB_PORT:55432}/photo","spring.datasource.username=photo","spring.datasource.password=photo-local-only","spring.datasource.driver-class-name=org.postgresql.Driver","spring.jpa.hibernate.ddl-auto=create-drop","spring.flyway.enabled=false","bobbuy.security.header-auth.enabled=false","bobbuy.ai.costco.worker.enabled=true","bobbuy.ai.costco.worker.delay-millis=1000","bobbuy.seed.force-reset-on-invoke=false","bobbuy.ai.costco.quota.pending=2","bobbuy.ai.costco.quota.daily=3","bobbuy.ai.costco.quota.evidence-bytes=8388608"})
@AutoConfigureMockMvc
class ProductPhotoIntakeIntegrationTest {
 @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired JdbcTemplate jdbc;@Autowired BobbuyStore store;
 @Autowired ProductRepository products;@Autowired SupplierRepository suppliers;@Autowired UserRepository users;
 @Autowired JwtTokenService tokens;@Autowired CostcoEvidencePersistence evidence;@Autowired CategoryTreeNodeRepository categories;
 String auth,foreign,customer,supplier,job,item;Product product;
 @BeforeEach void setup() throws Exception {
  try(var c=Objects.requireNonNull(jdbc.getDataSource()).getConnection()){
   if(!Boolean.TRUE.equals(jdbc.queryForObject("select to_regclass('bb_costco_onboarding_job') is not null",Boolean.class)))ScriptUtils.executeSqlScript(c,new ClassPathResource("db/migration/V30__costco_onboarding_jobs.sql"));
   ScriptUtils.executeSqlScript(c,new ClassPathResource("db/migration/V48__product_photo_observations.sql"));
   applyPhotoQueueMigration(c);
  }
  if(users.findById(1000L).isEmpty())store.seed();
  auth=tokens.createAccessToken(users.findById(1000L).orElseThrow());
  var other=users.findById(9191L).orElseGet(()->users.saveAndFlush(new User(9191L,"photo-other",Role.AGENT,0)));foreign=tokens.createAccessToken(other);
  customer=tokens.createAccessToken(users.findAll().stream().filter(u->u.getRoles().contains(Role.CUSTOMER)).findFirst().orElseThrow());
  supplier=suppliers.findAll().stream().filter(s->Long.valueOf(1000).equals(s.getMerchantId())).findFirst().orElseThrow().getId();
  categories.saveAndFlush(new CategoryTreeNode("system-uncategorized",null,Map.of("ja-JP","未分類"),List.of("system-uncategorized"),Integer.MAX_VALUE,"UNCATEGORIZED"));
  item=String.valueOf(100000000+new java.security.SecureRandom().nextInt(899999999));
  product=new Product();product.setId(UUID.randomUUID().toString());product.setMerchantId(1000L);product.setName(Map.of("ja-JP","合成現場商品"));product.setItemNumber(item);product.setBasePrice(1234);product.setAttributes(Map.of("sourceMarket","JP"));product.setCatalogData(new ProductCatalogData(Map.of("ja-JP","80 × 2"),null,"80 × 2",List.of(),supplier,null,null,null));product=products.saveAndFlush(product);
  job=makeJob(item);
 }
 String makeJob(String number)throws Exception{
  byte[] bytes;try(var out=new java.io.ByteArrayOutputStream()){var image=new java.awt.image.BufferedImage(800,600,java.awt.image.BufferedImage.TYPE_INT_RGB);var g=image.createGraphics();g.setColor(java.awt.Color.WHITE);g.fillRect(0,0,800,600);g.setColor(new java.awt.Color(225,230,215));g.fillRoundRect(40,50,300,380,24,24);g.setColor(java.awt.Color.BLACK);g.setFont(new java.awt.Font("SansSerif",java.awt.Font.BOLD,30));g.drawString("SYNTHETIC TEST",60,110);g.drawString("PRODUCT 80 x 2",60,165);g.drawRect(380,120,380,310);g.drawString("ITEM "+number,400,180);g.setFont(new java.awt.Font("SansSerif",java.awt.Font.BOLD,54));g.drawString("JPY 999",400,270);g.setFont(new java.awt.Font("SansSerif",java.awt.Font.PLAIN,28));g.drawString("per 80 x 2 pack",400,335);g.drawString("TEST FIXTURE - NOT A REAL OFFER",60,520);g.dispose();image.setRGB(0,0,java.util.concurrent.ThreadLocalRandom.current().nextInt());javax.imageio.ImageIO.write(image,"png",out);bytes=out.toByteArray();}
  String photo=evidence.putPrivatePhoto(1000,bytes);String id=UUID.randomUUID().toString();var j=new CostcoOnboardingJob(id,CostcoEvidencePersistence.hash(id.getBytes()),1000,supplier,"JP","a".repeat(64),number,photo,7,CostcoOnboardingJob.State.NEEDS_INPUT,List.of(),List.of(new CostcoOnboardingDecision(CostcoOnboardingDecision.Stage.INTAKE,CostcoOnboardingDecision.Verdict.ACCEPT,"integration-fixture-not-live","fixture",CostcoNumberOnboardingService.REQUIRED_NODE,"a".repeat(64),List.of(),"fixture","fixture","Synthetic test evidence",number,new CostcoOnboardingDecision.Candidate(number,null,"合成現場商品",null,"80 × 2","80 × 2",null,Map.of("ja-JP","合成現場商品","en-US","Synthetic field product"),List.of(),List.of(),null,new CostcoOnboardingDecision.PhotoFacts(new java.math.BigDecimal("999"),"JPY","80 × 2","","WAREHOUSE",true)))),null,null,"photo.confirm_required",Instant.now());
  jdbc.update("insert into bb_costco_onboarding_job(id,merchant_id,supplier_id,market,idempotency_key,input_hash,revision,state,payload) values(?,?,?,?,?,?,7,'NEEDS_INPUT',cast(? as jsonb))",id,1000,supplier,"JP",j.idempotencyKey(),j.inputHash(),json.writeValueAsString(j));return id;
 }
 ObjectNode input(){var x=json.createObjectNode();x.put("revision",7);x.put("itemNumber",item);x.put("productId",product.getId());x.put("productVersion",product.getRecordVersion());x.put("identityConfirmed",true);x.put("priceConfirmed",true);x.put("amount",999);x.put("currency","JPY");x.put("unit","80 × 2");x.put("inStock",true);x.put("observedAt",Instant.now().minusSeconds(60).toString());return x;}
 JsonNode confirm(String id,ObjectNode x,String token)throws Exception{return json.readTree(mvc.perform(post("/api/product-photo-intake/"+id+"/confirm").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(x.toString())).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray()).path("data");}
 JsonNode review(String id)throws Exception{return json.readTree(mvc.perform(get("/api/product-photo-intake/"+id).header("Authorization","Bearer "+auth)).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray()).path("data");}
 @Test void photoQueueFindsExistingPhotosAndReflectsConfirmationForTheirOwner()throws Exception{
  String another=makeJob(String.valueOf(Long.parseLong(item)+1));
  mvc.perform(get("/api/product-photo-intake").header("Authorization","Bearer "+auth))
   .andExpect(status().isOk()).andExpect(jsonPath("$.data[*].id",org.hamcrest.Matchers.hasItems(job,another)))
   .andExpect(jsonPath("$.data[?(@.id == '"+job+"')].reviewReady",org.hamcrest.Matchers.contains(true)));
  mvc.perform(get("/api/product-photo-intake").header("Authorization","Bearer "+foreign))
   .andExpect(status().isOk()).andExpect(jsonPath("$.data").isEmpty());
  mvc.perform(get("/api/product-photo-intake").header("Authorization","Bearer "+customer))
   .andExpect(status().isForbidden());
  confirm(job,input(),auth);
  mvc.perform(get("/api/product-photo-intake").header("Authorization","Bearer "+auth))
   .andExpect(status().isOk()).andExpect(jsonPath("$.data[?(@.id == '"+job+"')].state",org.hamcrest.Matchers.contains("COMPLETED")));
 }
 @Test void reopensPersistedTranscriptionOnlyForThePhotoOwner() throws Exception {
  String raw="TEST FIXTURE\nJPY 999 per 80 × 2";
  var transcription=json.createObjectNode();
  transcription.putArray("tags").addObject().put("rawText",raw).put("itemNumber",item)
   .put("unit","80 × 2").putArray("prices").addObject().put("kind","TOTAL")
   .put("amount",999).put("rawText","JPY 999").put("currency","JPY");
  transcription.putArray("productFeatures").add("Green test package");
  transcription.putArray("uncertainties").add("Partially hidden label");
  jdbc.update("""
   update bb_costco_onboarding_job
      set payload=jsonb_set(payload,'{decisions,0,candidate,photoFacts,transcription}',cast(? as jsonb))
    where id=? and merchant_id=1000
   """,transcription.toString(),job);
  var result=review(job).path("photoFacts").path("transcription");
  assertThat(result.path("tags").get(0).path("rawText").asText()).isEqualTo(raw);
  assertThat(result.path("tags").get(0).path("prices").get(0).path("kind").asText()).isEqualTo("TOTAL");
  assertThat(result.path("uncertainties").get(0).asText()).isEqualTo("Partially hidden label");
  mvc.perform(get("/api/product-photo-intake/"+job).header("Authorization","Bearer "+foreign)).andExpect(status().isNotFound());
  assertThat(jdbc.queryForObject("select count(*) from bb_product_photo_observation where job_id=?",Long.class,job)).isZero();
 }
 @Test void concurrentLegacyRetriesReuseTheOwnedJobAndEvidenceAtNumberCapacity() throws Exception {
  jdbc.update("""
    insert into bb_costco_onboarding_job
      (id,merchant_id,supplier_id,market,idempotency_key,input_hash,state,payload,next_run_at)
    select 'number-fixture-'||n,1000,?,'JP',md5('fixture-key-'||n),md5('fixture-input-'||n),
      'QUEUED','{}'::jsonb,current_timestamp+interval '1 hour' from generate_series(1,32) n
    """,supplier);
  jdbc.update("""
    update bb_costco_onboarding_job
       set payload=payload || '{"failureCode":"ai.pinned_endpoint","itemNumber":null,"decisions":[]}'::jsonb
     where id=?
    """,job);
  String path="/api/product-photo-intake/"+job+"/retry";
  byte[] before=mvc.perform(get("/api/product-photo-intake/"+job+"/photo").header("Authorization","Bearer "+auth))
    .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
  mvc.perform(post(path).param("revision","7").header("Authorization","Bearer "+foreign)).andExpect(status().isNotFound());
  var pool=java.util.concurrent.Executors.newFixedThreadPool(2);
  try {
   var submissions=pool.invokeAll(java.util.Collections.nCopies(2,(java.util.concurrent.Callable<String>)()->
      mvc.perform(post(path).param("revision","7").header("Authorization","Bearer "+auth))
       .andExpect(status().isOk()).andExpect(jsonPath("$.data.id").value(job)).andReturn().getResponse().getContentAsString()));
   for(var response:submissions)assertThat(json.readTree(response.get()).path("data").path("revision").asLong()).isGreaterThanOrEqualTo(8);
  } finally { pool.shutdownNow(); }
  assertThat(jdbc.queryForObject("select count(*) from bb_costco_onboarding_job where merchant_id=1000 and payload->>'privatePhotoSha256'=?",Long.class,CostcoEvidencePersistence.hash(before))).isEqualTo(1L);
  assertThat(jdbc.queryForObject("select count(*) from bb_product_photo_observation where job_id=?",Long.class,job)).isZero();
  assertThat(mvc.perform(get("/api/product-photo-intake/"+job+"/photo").header("Authorization","Bearer "+auth))
    .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray()).isEqualTo(before);
 }

 @Test @EnabledIfEnvironmentVariable(named="BOBBUY_PHOTO_LIVE_TEST", matches="true")
 void livePhotoMatchesAndUpdatesObservation() throws Exception {
  categories.saveAndFlush(new CategoryTreeNode("photo-live-frozen-seafood",null,
    Map.of("ja-JP","冷凍魚介類"),List.of("photo-live-frozen-seafood"),0,null));
  product.setItemNumber("53432");
  product.setName(Map.of("ja-JP","生食用シーフードミックス"));
  product.setCatalogData(new ProductCatalogData(Map.of("ja-JP","1 kg"),null,"1 kg",List.of(),supplier,null,null,null));
  product=products.saveAndFlush(product);

  var matched=recognizeLivePhoto("IMG_1484.jpg");
  assertThat(matched.path("status").asText()).isEqualTo("MATCH");
  assertThat(matched.path("itemNumber").asText()).isEqualTo("53432");
  assertThat(matched.path("photoFacts").path("amount").decimalValue()).isEqualByComparingTo("2698");
  assertThat(matched.path("photoFacts").path("currency").asText()).isEqualTo("JPY");
  assertThat(matched.path("photoFacts").path("productVisible").asBoolean()).isTrue();
  assertThat(matched.path("sources").findValuesAsText("fetchedUrl"))
    .anyMatch(url->url.contains("/Frozen-Mixed-Seafood-1kg/p/53432"));
  assertThat(matched.path("candidate").path("specification").asText()).contains("18");
  assertThat(matched.path("archiveDetails").path("descriptionJa").asText()).isNotBlank();
  assertThat(matched.path("archiveDetails").path("storageCondition").asText()).isEqualTo("FROZEN");
  assertThat(matched.path("archiveDetails").path("categoryNodeId").asText()).isEqualTo("photo-live-frozen-seafood");
  System.out.println("LIVE PHOTO archive description, category and frozen storage suggestions reached review");
  System.out.println("LIVE PHOTO official Costco exact-item document verified; frozen storage recovered");
  assertThat(matched.path("officialImageAvailable").asBoolean()).isTrue();
  mvc.perform(get("/api/product-photo-intake/"+matched.path("jobId").asText()+"/official-image")
    .header("Authorization","Bearer "+auth)).andExpect(status().isOk())
    .andExpect(content().contentTypeCompatibleWith(MediaType.IMAGE_JPEG));
  System.out.println("LIVE PHOTO official Costco image passed same-item pixel review and private readback");
  var existingInput=liveObservation(matched);
  existingInput.put("productId",product.getId());
  existingInput.put("productVersion",product.getRecordVersion());
  var saved=confirm(matched.path("jobId").asText(),existingInput,auth);
  assertThat(saved.path("amount").decimalValue()).isEqualByComparingTo("2698");
  assertThat(saved.path("inStock").asBoolean()).isTrue();
  assertThat(review(matched.path("jobId").asText()).path("saved")).isEqualTo(saved);
  assertThat(products.findById(product.getId()).orElseThrow().getBasePrice()).isEqualTo(1234);
  System.out.println("LIVE PHOTO existing item 53432 confirmed and reopened");
 }

 @Test @EnabledIfEnvironmentVariable(named="BOBBUY_PHOTO_LIVE_TEST", matches="true")
 void livePhotoCreatesPrivateMaster() throws Exception {
  String existingRecognition=System.getenv("BOBBUY_PHOTO_TEST_REUSE_NEW_JOB");
  var fresh=existingRecognition==null?recognizeLivePhoto("IMG_1638.jpg"):review(existingRecognition);
  assertThat(fresh.path("status").asText()).isEqualTo("NEW");
  assertThat(fresh.path("itemNumber").asText()).isEqualTo("93963");
  var candidate=fresh.path("candidate");
  assertThat(candidate.path("translatedNames").path("ja-JP").asText()).contains("抹茶");
  assertThat(fresh.path("photoFacts").path("amount").decimalValue()).isEqualByComparingTo("798");
  var creation=liveObservation(fresh);
  var draft=creation.putObject("product");
  draft.set("name",candidate.path("translatedNames"));
  String specification=candidate.path("specification").asText();
  assertThat(specification.replace(" ","")).containsAnyOf("1000g","1kg");
  draft.putObject("specification").put("ja-JP",specification);
  draft.set("brand",candidate.path("brand"));
  var fields=fresh.path("archiveDetails");
  String description=fields.path("descriptionJa").asText("");
  if(!description.isBlank())draft.putObject("description").put("ja-JP",description);
  draft.put("categoryNodeId",fields.path("categoryNodeId").asText(null));
  draft.put("storageCondition",fields.path("storageCondition").asText(null));
  var created=confirm(fresh.path("jobId").asText(),creation,auth);
  assertThat(created.path("amount").decimalValue()).isEqualByComparingTo("798");
  var reopened=products.findById(created.path("productId").asText()).orElseThrow();
  assertThat(reopened.getVisibilityStatus()).isEqualTo(ProductVisibility.DRAFTER_ONLY);
  assertThat(reopened.getSale()).isNull();
  assertThat(reopened.getName().get("ja-JP")).contains("抹茶");
  assertThat(reopened.getCatalogData().specification()).containsEntry("ja-JP",specification);
  if(!description.isBlank())assertThat(reopened.getDescription()).containsEntry("ja-JP",description);
  if(fields.hasNonNull("storageCondition"))assertThat(reopened.getStorageCondition().name()).isEqualTo(fields.path("storageCondition").asText());
  assertThat(products.findAllByMerchantIdAndItemNumber(1000L,"93963")).hasSize(1);
  assertThat(review(fresh.path("jobId").asText()).path("saved")).isEqualTo(created);
  System.out.println("LIVE PHOTO new item 93963 created privately and reopened");
 }

 private JsonNode recognizeLivePhoto(String filename) throws Exception {
  var source=Path.of("../sample",filename);
  var photo=new MockMultipartFile("file",filename,"image/jpeg",Files.readAllBytes(source));
  var response=mvc.perform(multipart("/api/ai/costco-onboarding/photo").file(photo)
          .param("requestId",UUID.randomUUID().toString()).param("supplierId",supplier).param("market","JP")
          .header("Authorization","Bearer "+auth)).andExpect(status().isOk()).andReturn().getResponse();
  String id=json.readTree(response.getContentAsByteArray()).path("data").path("id").asText();
  assertThat(id).isNotBlank();
  Instant deadline=Instant.now().plusSeconds(390);
  String lastState="";
  while(Instant.now().isBefore(deadline)){
   var current=mvc.perform(get("/api/ai/costco-onboarding/"+id).header("Authorization","Bearer "+auth))
           .andExpect(status().isOk()).andReturn().getResponse();
   var result=json.readTree(current.getContentAsByteArray()).path("data");
   String state=result.path("state").asText();
   String stage=result.path("stage").asText();
   if(!state.equals(lastState))System.out.printf("LIVE PHOTO %s state=%s stage=%s failure=%s%n",filename,state,stage,result.path("failureCode").asText(""));
   lastState=state;
   if(Set.of("NEEDS_INPUT","FAILED","RETRY_WAIT","COMPLETED").contains(state)){
    var reviewed=review(id);
    assertThat(reviewed.path("photoFacts").isObject()).as("real photo intake returned pixel facts (%s)",result.path("failureCode").asText("")).isTrue();
    if (filename.equals("IMG_1484.jpg")) assertThat(result.path("failureCode").asText()).isEqualTo("photo.confirm_required");
    return reviewed;
   }
   Thread.sleep(2000);
  }
  throw new AssertionError("Live photo did not reach confirmation: "+lastState);
 }

 private ObjectNode liveObservation(JsonNode review) {
  var request=json.createObjectNode();
  request.put("revision",review.path("revision").asLong());
  request.put("itemNumber",review.path("itemNumber").asText());
  request.put("identityConfirmed",true);
  request.put("priceConfirmed",true);
  request.put("inStock",true);
  request.put("observedAt",Instant.now().minusSeconds(60).toString());
  var facts=review.path("photoFacts");
  request.set("amount",facts.path("amount"));
  request.set("currency",facts.path("currency"));
  request.set("unit",facts.path("unit"));
  return request;
 }
 @Autowired CostcoOnboardingWorker worker;
 @Autowired JdbcCostcoOnboardingJobRepository queueRepository;

 byte[] image(int color) throws Exception {
  var image=new java.awt.image.BufferedImage(40,40,java.awt.image.BufferedImage.TYPE_INT_RGB);
  var brush=image.createGraphics();
  brush.setColor(new java.awt.Color(color));brush.fillRect(0,0,40,40);brush.dispose();
  try(var out=new java.io.ByteArrayOutputStream()){javax.imageio.ImageIO.write(image,"png",out);return out.toByteArray();}
 }
 JsonNode enqueue(String request, byte[] bytes, int status) throws Exception {
  return json.readTree(mvc.perform(multipart("/api/ai/costco-onboarding/photo")
    .file(new MockMultipartFile("file","photo.png","image/png",bytes))
    .param("requestId",request).param("supplierId",supplier).param("market","JP")
    .header("Authorization","Bearer "+auth)).andExpect(status().is(status))
    .andReturn().getResponse().getContentAsByteArray()).path("data");
 }
 JsonNode queue() throws Exception {
  return json.readTree(mvc.perform(get("/api/product-photo-intake").header("Authorization","Bearer "+auth))
    .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray()).path("data");
 }
 @Test void acceptsMoreThanFortyWithoutAWorkerAndReclaimsAfterRestart() throws Exception {
  worker.stop();
  try {
   jdbc.update("update bb_costco_onboarding_job set next_run_at=current_timestamp+interval '1 day' where state in ('QUEUED','RETRY_WAIT','AI_INTAKE','EVIDENCE_FETCH','AI_REVIEW')");
   Set<String> ids=new HashSet<>();
   for(int n=0;n<45;n++){
    var row=enqueue(UUID.randomUUID().toString(),image(0xea4200+n),200);
    assertThat(row.path("state").asText()).isEqualTo("QUEUED");
    ids.add(row.path("id").asText());
   }
   assertThat(ids).hasSize(45);
   assertThat(queue().findValuesAsText("id")).containsAll(ids);
   var lease=queueRepository.claimNext(Instant.now()).orElseThrow();
   assertThat(ids).contains(lease.job().id());
   jdbc.update("update bb_costco_onboarding_job set next_run_at=current_timestamp+interval '1 day' where state='QUEUED' and id<>?",lease.job().id());
   jdbc.update("update bb_costco_onboarding_job set lease_until=current_timestamp-interval '1 second' where id=?",lease.job().id());
   worker.start();
   long until=System.nanoTime()+TimeUnit.SECONDS.toNanos(12);
   while(queueRepository.findOwned(lease.job().id(),1000).orElseThrow().state()==CostcoOnboardingJob.State.QUEUED&&System.nanoTime()<until)Thread.sleep(100);
   assertThat(queueRepository.findOwned(lease.job().id(),1000).orElseThrow().state()).isNotEqualTo(CostcoOnboardingJob.State.QUEUED);
  } finally {worker.start();}
 }

 @Test void concurrentContentAliasesReuseHistoricalJobAndProtectRequestKey() throws Exception {
  worker.stop();
  var pool=Executors.newFixedThreadPool(2);
  try {
   byte[] bytes=image(0xcb1234);
   String originalRequest=UUID.randomUUID().toString(), aliasRequest=UUID.randomUUID().toString();
   var historical=enqueue(originalRequest,bytes,200);String id=historical.path("id").asText();
   // The original job uses only the historical request key in the task table.
   assertThat(jdbc.queryForObject("select count(*) from bb_product_photo_request where job_id=?",Long.class,id)).isZero();
   var requests=pool.invokeAll(List.<Callable<JsonNode>>of(
     ()->enqueue(aliasRequest,bytes,200),()->enqueue(UUID.randomUUID().toString(),bytes,200)));
   for(var result:requests)assertThat(result.get().path("id").asText()).isEqualTo(id);
   enqueue(aliasRequest,image(0xcb1235),409);
   enqueue(originalRequest,image(0xcb1236),409);
   assertThat(jdbc.queryForObject("select count(*) from bb_costco_onboarding_job where payload->>'privatePhotoSha256'=?",Long.class,CostcoEvidencePersistence.hash(bytes))).isEqualTo(1);
   var old=queueRepository.findOwned(id,1000).orElseThrow();
   var failed=new CostcoOnboardingJob(old.id(),old.idempotencyKey(),old.merchantId(),old.supplierId(),old.market(),
     old.inputHash(),item,old.privatePhotoSha256(),1,CostcoOnboardingJob.State.FAILED,List.of(),List.of(),
     null,null,"onboarding.retry_exhausted",Instant.now());
   jdbc.update("update bb_costco_onboarding_job set state='FAILED',revision=1,attempts=3,payload=cast(? as jsonb) where id=?",json.writeValueAsString(failed),id);
   mvc.perform(post("/api/product-photo-intake/"+id+"/retry").param("revision","1").header("Authorization","Bearer "+auth))
     .andExpect(status().isOk()).andExpect(jsonPath("$.data.id").value(id)).andExpect(jsonPath("$.data.state").value("QUEUED"));
   mvc.perform(get("/api/product-photo-intake/"+id+"/photo").header("Authorization","Bearer "+auth))
     .andExpect(status().isOk()).andExpect(content().bytes(bytes));
   assertThat(jdbc.queryForObject("select attempts from bb_costco_onboarding_job where id=?",Integer.class,id)).isZero();
  } finally {pool.shutdownNow();worker.start();}
 }

 private void applyPhotoQueueMigration(java.sql.Connection connection) {
  ScriptUtils.executeSqlScript(connection,new ClassPathResource("db/migration/V50__product_photo_queue_requests.sql"));
 }

 @Test void migrationCanRunAgainWithExistingRequestAliases() throws Exception {
  worker.stop();
  try{
   byte[] bytes=image(0xee1900);
   String id=enqueue(UUID.randomUUID().toString(),bytes,200).path("id").asText();
   String alias=UUID.randomUUID().toString();
   assertThat(enqueue(alias,bytes,200).path("id").asText()).isEqualTo(id);
   try(var connection=Objects.requireNonNull(jdbc.getDataSource()).getConnection()){
    applyPhotoQueueMigration(connection);
    applyPhotoQueueMigration(connection);
   }
   assertThat(enqueue(alias,bytes,200).path("id").asText()).isEqualTo(id);
   assertThat(jdbc.queryForObject("select count(*) from bb_product_photo_request where job_id=?",Long.class,id)).isEqualTo(1);
   assertThat(jdbc.queryForObject("""
     select count(*) from pg_indexes where indexname in ('bb_product_photo_job_hash','bb_product_photo_observation_hash')
     """,Long.class)).isEqualTo(2);
  }finally{worker.start();}
 }

 @Test void privatePhotoHistoryNeverConsumesOfficialEvidenceBudget() throws Exception {
  worker.stop();
  String officialHash=null;
  try{
   // Compressed synthetic rows model more than the old 512 MiB logical photo budget.
   jdbc.update("""
     insert into bb_costco_onboarding_evidence(merchant_id,sha256,kind,content_type,content)
     select 1000,repeat(md5('synthetic-history-'||row),2),'PRIVATE_PHOTO','image/png',
       decode(repeat('00',8388608),'hex')
     from generate_series(1,65) as row
     """);
   long historicalBytes=jdbc.queryForObject("""
     select sum(octet_length(content)) from bb_costco_onboarding_evidence where merchant_id=1000 and kind='PRIVATE_PHOTO'
     """,Long.class);
   assertThat(historicalBytes).isGreaterThan(512L*1024*1024);
   byte[] photo=image(0xee1901);
   String id=enqueue(UUID.randomUUID().toString(),photo,200).path("id").asText();
   mvc.perform(get("/api/product-photo-intake/"+id+"/photo").header("Authorization","Bearer "+auth))
     .andExpect(status().isOk()).andExpect(content().bytes(photo));
   long officialBytes=jdbc.queryForObject("""
     select coalesce(sum(octet_length(content)),0) from bb_costco_onboarding_evidence
     where merchant_id=1000 and kind='OFFICIAL_EVIDENCE'
     """,Long.class);
   byte[] official=new byte[Math.toIntExact(8L*1024*1024-officialBytes)];
   var proof=officialReceipt(official);
   officialHash=proof.sha256();
   var query=new CostcoOfficialEvidenceFetcher.Query(1000,supplier,"JP",item,null,"b".repeat(64));
   evidence.put(query,proof,official);
   byte[] additional=image(0xee1902);
   assertThatThrownBy(()->evidence.put(query,officialReceipt(additional),additional))
     .isInstanceOf(CostcoOnboardingQuotaException.class).hasMessage("onboarding.evidence_quota");
   assertThat(enqueue(UUID.randomUUID().toString(),additional,200).path("state").asText()).isEqualTo("QUEUED");
  }finally{
   jdbc.update("""
     delete from bb_costco_onboarding_evidence where merchant_id=1000 and (sha256=?
        or sha256 in (select repeat(md5('synthetic-history-'||row),2) from generate_series(1,65) as row))
     """,officialHash);
   worker.start();
  }
 }

 private CostcoOfficialEvidence officialReceipt(byte[] bytes) {
  var source=java.net.URI.create("https://example.test/synthetic-official-receipt");
  return new CostcoOfficialEvidence("synthetic",source,source,CostcoEvidencePersistence.hash(bytes),Instant.now(),
    "application/octet-stream",null,null,List.of());
 }

 @Test void numberLimitsCountOnlyNumberJobs() throws Exception {
  worker.stop();
  try{
   for(int n=0;n<4;n++)enqueue(UUID.randomUUID().toString(),image(0xee1910+n),200);
   String first=enqueueNumber("90000001",200,null).path("id").asText();
   String second=enqueueNumber("90000002",200,null).path("id").asText();
   enqueueNumber("90000003",429,"onboarding.pending_quota");
   setFixtureState(first,"FAILED",null);
   String third=enqueueNumber("90000003",200,null).path("id").asText();
   setFixtureState(second,"FAILED",null);
   setFixtureState(third,"FAILED",null);
   enqueueNumber("90000004",429,"onboarding.daily_quota");
   assertThat(enqueue(UUID.randomUUID().toString(),image(0xee1914),200).path("state").asText()).isEqualTo("QUEUED");
  }finally{worker.start();}
 }

 private JsonNode enqueueNumber(String number,int status,String reason) throws Exception {
  var body=json.createObjectNode().put("itemNumber",number).put("market","JP")
    .put("supplierId",supplier).put("requestId",UUID.randomUUID().toString());
  var response=mvc.perform(post("/api/ai/costco-onboarding").header("Authorization","Bearer "+auth)
    .contentType(MediaType.APPLICATION_JSON).content(body.toString())).andExpect(status().is(status));
  if(reason!=null)response.andExpect(content().string(org.hamcrest.Matchers.containsString(reason)));
  return json.readTree(response.andReturn().getResponse().getContentAsByteArray()).path("data");
 }

 @Test @EnabledIfEnvironmentVariable(named="BOBBUY_PHOTO_QUEUE_BROWSER",matches="true")
 void browserQueueAgainstRealLocalApi() throws Exception {
  worker.stop();
  try{
   String saved=makeJob(item);confirm(saved,input(),auth);
   String running=enqueue(UUID.randomUUID().toString(),image(0xdd1234),200).path("id").asText();
   String failed=enqueue(UUID.randomUUID().toString(),image(0xdd1235),200).path("id").asText();
   setFixtureState(running,"AI_INTAKE",null);
   setFixtureState(failed,"FAILED","onboarding.retry_exhausted");
   var process=new ProcessBuilder("node","../frontend/scripts/photo-intake-browser.mjs").inheritIO();
   boolean screenshotOnly="true".equals(System.getenv("BOBBUY_PHOTO_QUEUE_CAPTURE_ONLY"));
   if(screenshotOnly)enqueue(UUID.randomUUID().toString(),image(0xdd1236),200);
   process.environment().put("PHOTO_BROWSER_EXTRA",screenshotOnly?"queue-supplement":"queue");
   process.environment().put("PHOTO_TEST_TOKEN",auth);
   process.environment().put("PHOTO_TEST_JOB",job);process.environment().put("PHOTO_TEST_FAILED_JOB",failed);
   var browser=process.start();
   try {
    assertThat(browser.waitFor(120,TimeUnit.SECONDS)).isTrue();
    assertThat(browser.exitValue()).isZero();
   } finally {
    if(browser.isAlive())browser.destroyForcibly();
   }
  }finally{worker.start();}
 }

 private void setFixtureState(String id,String state,String reason) {
  jdbc.update("update bb_costco_onboarding_job set state=?, payload=payload || jsonb_build_object('state',?::text,'failureCode',?::text) where id=?",state,state,reason,id);
 }

 @Test void atomicallyPersistsAndReopensWithoutSellingMutationAndReusesRetry()throws Exception{
  var x=input();var first=confirm(job,x,auth);assertThat(first.path("priceChanged").asBoolean()).isTrue();assertThat(confirm(job,x,auth)).isEqualTo(first);assertThat(review(job).path("saved")).isEqualTo(first);
  var current=products.findById(product.getId()).orElseThrow();assertThat(current.getBasePrice()).isEqualTo(1234);assertThat(current.getSale()).isNull();assertThat(current.getRecordVersion()).isEqualTo(product.getRecordVersion());
  String second=makeJob(item);x.put("previousId",first.path("id").asText());var same=confirm(second,x,auth);assertThat(same.path("priceChanged").asBoolean()).isFalse();assertThat(same.path("inStock").asBoolean()).isTrue();
  String third=makeJob(item);x.put("previousId",same.path("id").asText());x.putNull("amount");assertThat(confirm(third,x,auth).path("amount").isNull()).isTrue();
 }
 @Test void deniesCrossMerchantCustomerAndPrivateEvidenceAccess()throws Exception{
  mvc.perform(get("/api/product-photo-intake/"+job).header("Authorization","Bearer "+foreign)).andExpect(status().isNotFound());
  mvc.perform(get("/api/product-photo-intake/"+job+"/photo").header("Authorization","Bearer "+foreign)).andExpect(status().isNotFound());
  mvc.perform(get("/api/product-photo-intake/"+job).header("Authorization","Bearer "+customer)).andExpect(status().isForbidden());
  mvc.perform(get("/api/product-photo-intake/"+job+"/photo").header("Authorization","Bearer "+auth)).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"));
 }
 @Test void rejectsStaleVersionAndCurrencyPrecisionWithoutPartialWrite()throws Exception{
  var x=input();x.put("productVersion",999);mvc.perform(post("/api/product-photo-intake/"+job+"/confirm").header("Authorization","Bearer "+auth).contentType(MediaType.APPLICATION_JSON).content(x.toString())).andExpect(status().isBadRequest());
  x=input();x.put("amount",999.1);mvc.perform(post("/api/product-photo-intake/"+job+"/confirm").header("Authorization","Bearer "+auth).contentType(MediaType.APPLICATION_JSON).content(x.toString())).andExpect(status().isBadRequest());assertThat(review(job).path("saved").isNull()).isTrue();
 }
 @Test void legacyAndWrongMarketAreNotAutomaticMatchesAndDeletedBlocksCreate()throws Exception{
  product.setAttributes(Map.of());product=products.saveAndFlush(product);assertThat(review(job).path("status").asText()).isEqualTo("SELECT");assertThat(review(job).at("/matches/0/eligible").asBoolean()).isFalse();
  product.setAttributes(Map.of("sourceMarket","US"));products.saveAndFlush(product);assertThat(review(job).path("status").asText()).isEqualTo("NEW");
  jdbc.update("update bb_product set deleted_at=current_timestamp where id=?",product.getId());assertThat(review(job).path("status").asText()).isEqualTo("DELETED");
 }
 @Test void createsOnePrivateProductAndRollsBackInvalidCategory()throws Exception{
  String code=String.valueOf(Long.parseLong(item)+1);String id=makeJob(code);var x=input();x.putNull("productId");x.putNull("productVersion");x.put("itemNumber",code);var n=x.putObject("product");n.putObject("name").put("ja-JP","合成新品");n.putObject("specification").put("ja-JP","2個");n.put("categoryNodeId","missing-category");
  mvc.perform(post("/api/product-photo-intake/"+id+"/confirm").header("Authorization","Bearer "+auth).contentType(MediaType.APPLICATION_JSON).content(x.toString())).andExpect(status().isBadRequest());assertThat(products.findAllByMerchantIdAndItemNumber(1000L,code)).isEmpty();
  n.putNull("categoryNodeId");var first=confirm(id,x,auth);assertThat(confirm(id,x,auth)).isEqualTo(first);var p=products.findById(first.path("productId").asText()).orElseThrow();assertThat(p.getVisibilityStatus()).isEqualTo(ProductVisibility.DRAFTER_ONLY);assertThat(p.getSale()).isNull();assertThat(p.getCatalogData().supplierId()).isEqualTo(supplier);assertThat(p.getAttributes()).containsEntry("sourceMarket","JP");assertThat(products.findAllByMerchantIdAndItemNumber(1000L,code)).hasSize(1);
 }
 @Test void rejectsCreationRequestCollisionAndAllowsOtherSupplierIdentity()throws Exception{
  String code=String.valueOf(Long.parseLong(item)+4);String collision=makeJob(code);var p=new Product();p.setId(UUID.nameUUIDFromBytes(("manual-product:1000:"+collision).getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString());p.setMerchantId(1000L);p.setName(Map.of("ja-JP","Do not overwrite"));p.setItemNumber(item+"1");products.saveAndFlush(p);
  var x=input();x.putNull("productId");x.put("itemNumber",code);x.putObject("product").putObject("name").put("ja-JP","Wrong replacement");
  mvc.perform(post("/api/product-photo-intake/"+collision+"/confirm").header("Authorization","Bearer "+auth).contentType(MediaType.APPLICATION_JSON).content(x.toString())).andExpect(status().isBadRequest());assertThat(review(collision).path("saved").isNull()).isTrue();assertThat(products.findById(p.getId()).orElseThrow().getName()).containsEntry("ja-JP","Do not overwrite");
  var c=product.getCatalogData();product.setCatalogData(new ProductCatalogData(c.specification(),null,c.packaging(),List.of(),"different-supplier",null,null,null));products.saveAndFlush(product);
  assertThat(review(job).path("status").asText()).isEqualTo("NEW");x.put("itemNumber",item);var saved=confirm(job,x,auth);assertThat(saved.path("productId").asText()).isNotEqualTo(product.getId());assertThat(products.findAllByMerchantIdAndItemNumber(1000L,item)).hasSize(2);
 }
 @Test void verifiedOfficialImageRequiresOptInAndNeverPromotesPrivatePhoto()throws Exception{
  String code=String.valueOf(Long.parseLong(item)+12),id=makeJob(code);var x=input();x.putNull("productId");x.put("itemNumber",code);x.put("useOfficialImage",true);x.putObject("product").putObject("name").put("ja-JP","合成画像商品");
  mvc.perform(post("/api/product-photo-intake/"+id+"/confirm").header("Authorization","Bearer "+auth).contentType(MediaType.APPLICATION_JSON).content(x.toString())).andExpect(status().isBadRequest());assertThat(products.findAllByMerchantIdAndItemNumber(1000L,code)).isEmpty();
  var old=json.readValue(jdbc.queryForObject("select cast(payload as text) from bb_costco_onboarding_job where id=?",String.class,id),CostcoOnboardingJob.class);
  byte[] bytes;try(var out=new java.io.ByteArrayOutputStream()){javax.imageio.ImageIO.write(new java.awt.image.BufferedImage(40,40,java.awt.image.BufferedImage.TYPE_INT_RGB),"png",out);bytes=out.toByteArray();}
  String hash=CostcoEvidencePersistence.hash(bytes);var url=java.net.URI.create("https://example.test/verified-synthetic-product.png");var source=new CostcoOfficialEvidence("synthetic-source",url,url,hash,Instant.now(),"image/png",40,40,List.of());evidence.put(new CostcoOfficialEvidenceFetcher.Query(1000,supplier,"JP",code,old.privatePhotoSha256(),old.inputHash()),source,bytes);
  var c=new CostcoOnboardingDecision.Candidate(code,null,"合成画像商品",null,"80 × 2","80 × 2",hash,Map.of("ja-JP","合成画像商品"),List.of());var trace=new CostcoOnboardingDecision.EngineTrace("c".repeat(64),"d".repeat(64),1,null,null,Map.of(hash,hash));var d=new CostcoOnboardingDecision(CostcoOnboardingDecision.Stage.IMAGE_SOURCE,CostcoOnboardingDecision.Verdict.ACCEPT,"fixture-not-live","fixture",CostcoNumberOnboardingService.REQUIRED_NODE,old.inputHash(),List.of(hash),"fixture","fixture","Synthetic verified image",code,c,trace);
  var j=new CostcoOnboardingJob(old.id(),old.idempotencyKey(),1000,supplier,"JP",old.inputHash(),code,old.privatePhotoSha256(),old.revision(),old.state(),List.of(source),List.of(old.decisions().get(0),d),null,null,old.failureCode(),old.updatedAt());jdbc.update("update bb_costco_onboarding_job set payload=cast(? as jsonb) where id=?",json.writeValueAsString(j),id);
  assertThat(review(id).path("officialImageAvailable").asBoolean()).isTrue();mvc.perform(get("/api/product-photo-intake/"+id+"/official-image").header("Authorization","Bearer "+auth)).andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"));
  String corrected=String.valueOf(Long.parseLong(code)+1);
  var correctedReview=mvc.perform(get("/api/product-photo-intake/"+id).param("itemNumber",corrected).header("Authorization","Bearer "+auth)).andExpect(status().isOk()).andReturn().getResponse();
  assertThat(json.readTree(correctedReview.getContentAsByteArray()).path("data").path("officialImageAvailable").asBoolean(true)).isFalse();
  var wrong=x.deepCopy().put("itemNumber",corrected);
  mvc.perform(post("/api/product-photo-intake/"+id+"/confirm").header("Authorization","Bearer "+auth).contentType(MediaType.APPLICATION_JSON).content(wrong.toString())).andExpect(status().isBadRequest());
  assertThat(products.findAllByMerchantIdAndItemNumber(1000L,corrected)).isEmpty();
  assertThat(review(id).path("saved").isNull()).isTrue();
  JsonNode result;
  if("true".equals(System.getenv("BOBBUY_PHOTO_BROWSER"))){var process=new ProcessBuilder("node","../frontend/scripts/photo-intake-browser.mjs").inheritIO();process.environment().put("PHOTO_BROWSER_EXTRA","media");process.environment().put("PHOTO_TEST_TOKEN",auth);process.environment().put("PHOTO_TEST_JOB",id);assertThat(process.start().waitFor()).isZero();result=review(id).path("saved");}else result=confirm(id,x,auth);
  var created=products.findById(result.path("productId").asText()).orElseThrow();assertThat(created.getMediaGallery()).hasSize(1);assertThat(created.getMediaGallery().get(0).getSourceUrl()).isEqualTo(url.toString());assertThat(created.getVisibilityStatus()).isEqualTo(ProductVisibility.DRAFTER_ONLY);assertThat(created.getSale()).isNull();
 }
 @Test void concurrentDistinctJobsCannotCreateDuplicateIdentity()throws Exception{
  String code=String.valueOf(Long.parseLong(item)+8),a=makeJob(code),b=makeJob(code);var x=input();x.putNull("productId");x.put("itemNumber",code);x.putObject("product").putObject("name").put("ja-JP","Concurrent synthetic new item");
  var pool=Executors.newFixedThreadPool(2);try{var results=pool.invokeAll(List.<Callable<Integer>>of(()->mvc.perform(post("/api/product-photo-intake/"+a+"/confirm").header("Authorization","Bearer "+auth).contentType(MediaType.APPLICATION_JSON).content(x.toString())).andReturn().getResponse().getStatus(),()->mvc.perform(post("/api/product-photo-intake/"+b+"/confirm").header("Authorization","Bearer "+auth).contentType(MediaType.APPLICATION_JSON).content(x.toString())).andReturn().getResponse().getStatus()));assertThat(List.of(results.get(0).get(),results.get(1).get())).containsExactlyInAnyOrder(200,400);}finally{pool.shutdownNow();}
  assertThat(products.findAllByMerchantIdAndItemNumber(1000L,code)).hasSize(1);
 }
 @Test void unconfirmedAndCrossScopeTargetsHaveNoPartialWrites()throws Exception{
  var x=input();x.put("identityConfirmed",false);mvc.perform(post("/api/product-photo-intake/"+job+"/confirm").header("Authorization","Bearer "+auth).contentType(MediaType.APPLICATION_JSON).content(x.toString())).andExpect(status().isBadRequest());
  x=input();x.putNull("amount");x.put("inStock",false);mvc.perform(post("/api/product-photo-intake/"+job+"/confirm").header("Authorization","Bearer "+auth).contentType(MediaType.APPLICATION_JSON).content(x.toString())).andExpect(status().isBadRequest());
  product.setAttributes(Map.of("sourceMarket","US"));product=products.saveAndFlush(product);x=input();mvc.perform(post("/api/product-photo-intake/"+job+"/confirm").header("Authorization","Bearer "+auth).contentType(MediaType.APPLICATION_JSON).content(x.toString())).andExpect(status().isBadRequest());assertThat(review(job).path("saved").isNull()).isTrue();
 }
 @Test void concurrentConfirmationRecordsExactlyOneObservation()throws Exception{
  var x=input();var pool=Executors.newFixedThreadPool(2);try{var results=pool.invokeAll(List.<Callable<JsonNode>>of(()->confirm(job,x,auth),()->confirm(job,x,auth)));assertThat(results.get(0).get()).isEqualTo(results.get(1).get());}finally{pool.shutdownNow();}
  assertThat(jdbc.queryForObject("select count(*) from bb_product_photo_observation where job_id=?",Long.class,job)).isEqualTo(1);
 }
}
