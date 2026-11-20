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
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Dedicated synthetic cloud DB only. Real Postgres row locks, JSON, HTTP authorization and rollback. */
@EnabledIfEnvironmentVariable(named="BOBBUY_PHOTO_ISOLATED_TEST",matches="true")
@SpringBootTest(webEnvironment=SpringBootTest.WebEnvironment.DEFINED_PORT,properties={"server.port=18080","spring.datasource.url=jdbc:postgresql://127.0.0.1:55432/photo","spring.datasource.username=photo","spring.datasource.password=photo-local-only","spring.datasource.driver-class-name=org.postgresql.Driver","spring.jpa.hibernate.ddl-auto=create-drop","spring.flyway.enabled=false","bobbuy.security.header-auth.enabled=false","bobbuy.ai.costco.worker.enabled=true","bobbuy.ai.costco.worker.delay-millis=1000","bobbuy.seed.force-reset-on-invoke=false"})
@AutoConfigureMockMvc
class ProductPhotoIntakeIntegrationTest {
 @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired JdbcTemplate jdbc;@Autowired BobbuyStore store;
 @Autowired ProductRepository products;@Autowired SupplierRepository suppliers;@Autowired UserRepository users;
 @Autowired JwtTokenService tokens;@Autowired CostcoEvidencePersistence evidence;@Autowired CategoryTreeNodeRepository categories;
 String auth,foreign,customer,supplier,job,item;Product product;
 @BeforeEach void setup() throws Exception {
  try(var c=Objects.requireNonNull(jdbc.getDataSource()).getConnection()){
   if(!Boolean.TRUE.equals(jdbc.queryForObject("select to_regclass('bb_costco_onboarding_job') is not null",Boolean.class)))ScriptUtils.executeSqlScript(c,new ClassPathResource("db/migration/V30__costco_onboarding_jobs.sql"));
   ScriptUtils.executeSqlScript(c,new ClassPathResource("db/migration/V47__product_photo_observations.sql"));
   ScriptUtils.executeSqlScript(c,new ClassPathResource("db/migration/V47__product_photo_observations.sql"));
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
  byte[] bytes;try(var out=new java.io.ByteArrayOutputStream()){var image=new java.awt.image.BufferedImage(800,600,java.awt.image.BufferedImage.TYPE_INT_RGB);var g=image.createGraphics();g.setColor(java.awt.Color.WHITE);g.fillRect(0,0,800,600);g.setColor(new java.awt.Color(225,230,215));g.fillRoundRect(40,50,300,380,24,24);g.setColor(java.awt.Color.BLACK);g.setFont(new java.awt.Font("SansSerif",java.awt.Font.BOLD,30));g.drawString("SYNTHETIC TEST",60,110);g.drawString("PRODUCT 80 x 2",60,165);g.drawRect(380,120,380,310);g.drawString("ITEM "+number,400,180);g.setFont(new java.awt.Font("SansSerif",java.awt.Font.BOLD,54));g.drawString("JPY 999",400,270);g.setFont(new java.awt.Font("SansSerif",java.awt.Font.PLAIN,28));g.drawString("per 80 x 2 pack",400,335);g.drawString("TEST FIXTURE - NOT A REAL OFFER",60,520);g.dispose();javax.imageio.ImageIO.write(image,"png",out);bytes=out.toByteArray();}
  String photo=evidence.putPrivatePhoto(1000,bytes);String id=UUID.randomUUID().toString();var j=new CostcoOnboardingJob(id,CostcoEvidencePersistence.hash(id.getBytes()),1000,supplier,"JP","a".repeat(64),number,photo,7,CostcoOnboardingJob.State.NEEDS_INPUT,List.of(),List.of(new CostcoOnboardingDecision(CostcoOnboardingDecision.Stage.INTAKE,CostcoOnboardingDecision.Verdict.ACCEPT,"integration-fixture-not-live","fixture",CostcoNumberOnboardingService.REQUIRED_NODE,"a".repeat(64),List.of(),"fixture","fixture","Synthetic test evidence",number,new CostcoOnboardingDecision.Candidate(number,null,"合成現場商品",null,"80 × 2","80 × 2",null,Map.of("ja-JP","合成現場商品","en-US","Synthetic field product"),List.of(),List.of(),null,new CostcoOnboardingDecision.PhotoFacts(new java.math.BigDecimal("999"),"JPY","80 × 2","","WAREHOUSE",true)))),null,null,"photo.confirm_required",Instant.now());
  jdbc.update("insert into bb_costco_onboarding_job(id,merchant_id,supplier_id,market,idempotency_key,input_hash,revision,state,payload) values(?,?,?,?,?,?,7,'NEEDS_INPUT',cast(? as jsonb))",id,1000,supplier,"JP",j.idempotencyKey(),j.inputHash(),json.writeValueAsString(j));return id;
 }
 ObjectNode input(){var x=json.createObjectNode();x.put("revision",7);x.put("itemNumber",item);x.put("productId",product.getId());x.put("productVersion",product.getRecordVersion());x.put("identityConfirmed",true);x.put("priceConfirmed",true);x.put("amount",999);x.put("currency","JPY");x.put("unit","80 × 2");x.put("inStock",true);x.put("observedAt",Instant.now().minusSeconds(60).toString());return x;}
 JsonNode confirm(String id,ObjectNode x,String token)throws Exception{return json.readTree(mvc.perform(post("/api/product-photo-intake/"+id+"/confirm").header("Authorization","Bearer "+token).contentType(MediaType.APPLICATION_JSON).content(x.toString())).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data");}
 JsonNode review(String id)throws Exception{return json.readTree(mvc.perform(get("/api/product-photo-intake/"+id).header("Authorization","Bearer "+auth)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("data");}
 @Test @EnabledIfEnvironmentVariable(named="BOBBUY_PHOTO_BROWSER",matches="true")
 void browserAcceptanceAgainstRealLocalApi()throws Exception{
  var process=new ProcessBuilder("node","../frontend/scripts/photo-intake-browser.mjs").inheritIO();
  process.environment().put("PHOTO_TEST_TOKEN",auth);process.environment().put("PHOTO_TEST_JOB",job);process.environment().put("PHOTO_TEST_NEW_JOB",makeJob(String.valueOf(Long.parseLong(item)+2)));process.environment().put("PHOTO_TEST_PRODUCT",product.getId());
  assertThat(process.start().waitFor()).isZero();
 }

 @Test @EnabledIfEnvironmentVariable(named="BOBBUY_PHOTO_BROWSER",matches="true")
 void browserHistoryAiFailureAndLongLabels()throws Exception{
  confirm(job,input(),auth);
  var process=new ProcessBuilder("node","../frontend/scripts/photo-intake-browser.mjs").inheritIO();
  process.environment().put("PHOTO_BROWSER_EXTRA","1");process.environment().put("PHOTO_TEST_TOKEN",auth);process.environment().put("PHOTO_TEST_JOB",job);process.environment().put("PHOTO_TEST_NEW_JOB",makeJob(item));
  assertThat(process.start().waitFor()).isZero();
 }
 @Test @EnabledIfEnvironmentVariable(named="BOBBUY_PHOTO_BROWSER",matches="true")
 void browserAiFailureCopy()throws Exception{
  var process=new ProcessBuilder("node","../frontend/scripts/photo-intake-browser.mjs").inheritIO();process.environment().put("PHOTO_BROWSER_EXTRA","ai");process.environment().put("PHOTO_TEST_TOKEN",auth);process.environment().put("PHOTO_TEST_JOB",job);assertThat(process.start().waitFor()).isZero();
 }
 @Test @EnabledIfEnvironmentVariable(named="BOBBUY_PHOTO_BROWSER",matches="true")
 void browserActualFourLocales()throws Exception{
  var process=new ProcessBuilder("node","../frontend/scripts/photo-intake-browser.mjs").inheritIO();process.environment().put("PHOTO_BROWSER_EXTRA","locales");process.environment().put("PHOTO_TEST_TOKEN",auth);process.environment().put("PHOTO_TEST_JOB",job);assertThat(process.start().waitFor()).isZero();
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
