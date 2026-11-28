package com.bobbuy.service;

import com.bobbuy.api.BobbuyApplication;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.security.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.net.URI;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Synthetic, isolated PostgreSQL proof of the rapid publication and later image boundary. */
@EnabledIfEnvironmentVariable(named="BOBBUY_PHOTO_ISOLATED_TEST", matches="true")
@SpringBootTest(classes=BobbuyApplication.class, properties={
    "spring.datasource.url=jdbc:postgresql://127.0.0.1:${BOBBUY_PHOTO_TEST_DB_PORT:55432}/photo",
    "spring.datasource.username=photo", "spring.datasource.password=photo-local-only",
    "spring.datasource.driver-class-name=org.postgresql.Driver", "spring.jpa.hibernate.ddl-auto=create-drop", "spring.flyway.enabled=false",
    "bobbuy.photo-quick-publish.worker.enabled=false", "bobbuy.official-image-lookup.worker.enabled=true",
    "bobbuy.ai.costco.worker.enabled=false", "bobbuy.seed.force-reset-on-invoke=false"})
class PhotoQuickPublishIntegrationTest {
  @Autowired JdbcTemplate jdbc;
  @Autowired ObjectMapper json;
  @Autowired BobbuyStore store;
  @Autowired UserRepository users;
  @Autowired SupplierRepository suppliers;
  @Autowired CategoryTreeNodeRepository categories;
  @Autowired ProductRepository products;
  @Autowired PhotoQuickPublishService service;
  @Autowired OfficialImageLookupWorker imageWorker;
  @Autowired CostcoEvidencePersistence evidence;
  @MockBean OfficialImageCandidateFinder finder;

  long owner=1000L;
  String supplier;

  @BeforeEach void setup() throws Exception {
    imageWorker.stop();
    try(var connection=Objects.requireNonNull(jdbc.getDataSource()).getConnection()) {
      if(!Boolean.TRUE.equals(jdbc.queryForObject("select to_regclass('bb_costco_onboarding_job') is not null",Boolean.class)))
        ScriptUtils.executeSqlScript(connection,new ClassPathResource("db/migration/V30__costco_onboarding_jobs.sql"));
      if(!Boolean.TRUE.equals(jdbc.queryForObject("select to_regclass('bb_product_photo_observation') is not null",Boolean.class)))
        ScriptUtils.executeSqlScript(connection,new ClassPathResource("db/migration/V48__product_photo_observations.sql"));
      if(!Boolean.TRUE.equals(jdbc.queryForObject("select to_regclass('bb_product_photo_request') is not null",Boolean.class)))
        ScriptUtils.executeSqlScript(connection,new ClassPathResource("db/migration/V50__product_photo_queue_requests.sql"));
      if(!Boolean.TRUE.equals(jdbc.queryForObject("select to_regclass('bb_photo_publish_batch') is not null",Boolean.class)))
        ScriptUtils.executeSqlScript(connection,new ClassPathResource("db/migration/V55__photo_quick_publish_batches.sql"));
    }
    if(users.findById(owner).isEmpty()) store.seed();
    authenticate(owner);
    supplier=suppliers.findAll().stream().filter(s->Objects.equals(s.getMerchantId(),owner)).findFirst().orElseThrow().getId();
    categories.saveAndFlush(new CategoryTreeNode("system-uncategorized",null,Map.of("ja-JP","未分類"),
        List.of("system-uncategorized"),Integer.MAX_VALUE,"UNCATEGORIZED"));
    categories.saveAndFlush(new CategoryTreeNode("rapid-test-category",null,Map.of("ja-JP","合成試験"),List.of("rapid-test-category"),0,null));
    jdbc.update("delete from bb_official_image_lookup");
    jdbc.update("delete from bb_photo_publish_item");
    jdbc.update("delete from bb_photo_publish_batch");
  }

  @AfterEach void clearAuth(){SecurityContextHolder.clearContext();}

  @Test void publishesEachVerifiedJobBeforeASeparateBatchImageSearchAndRetainsPublicProductsOnImageFailure() throws Exception {
    String request="synthetic-batch-"+UUID.randomUUID();
    var pool=Executors.newFixedThreadPool(2);
    try {
      var calls=List.of((Callable<String>)()->ownedCreate(request),(Callable<String>)()->ownedCreate(request));
      var ids=pool.invokeAll(calls).stream().map(f->{try{return f.get();}catch(Exception e){throw new AssertionError(e);}}).toList();
      assertThat(ids).containsOnly(ids.get(0));
    } finally { pool.shutdownNow(); }
    authenticate(owner);
    String batch=service.create(request,supplier,"JP").id();
    String readyItem=insertItem(batch,"ready",acceptedJob("900001",true));
    String heldItem=insertItem(batch,"held",acceptedJob("900002",false));
    service.seal(batch);

    service.process(readyItem);
    var first=service.get(batch).items().stream().filter(i->i.id().equals(readyItem)).findFirst().orElseThrow();
    assertThat(first.state()).isEqualTo("PUBLISHED");
    assertThat(first.productId()).isEqualTo(expectedProductId(readyItem));
    assertThat(products.findById(first.productId()).orElseThrow().getMediaGallery()).isEmpty();
    assertThat(jdbc.queryForObject("select count(*) from bb_official_image_lookup",Long.class)).isZero();

    service.process(heldItem);
    var held=service.get(batch).items().stream().filter(i->i.id().equals(heldItem)).findFirst().orElseThrow();
    assertThat(held.state()).isEqualTo("NEEDS_INFORMATION");
    assertThat(held.issueCode()).isEqualTo("quick_publish.missing_facts");
    assertThat(jdbc.queryForObject("select count(*) from bb_official_image_lookup",Long.class)).isZero();

    byte[] supplement;
    try (var stream = new java.io.ByteArrayOutputStream()) {
      var image = new java.awt.image.BufferedImage(400, 400, java.awt.image.BufferedImage.TYPE_INT_RGB);
      javax.imageio.ImageIO.write(image, "png", stream);
      supplement = stream.toByteArray();
    }
    service.supplement(batch,heldItem,held.revision(),supplement);
    String heldJob=jdbc.queryForObject("select onboarding_job_id from bb_photo_publish_item where id=cast(? as uuid)",String.class,heldItem);
    replaceJob(heldJob,"900002",true);
    service.process(heldItem);
    var completed=service.get(batch);
    assertThat(completed.state()).isEqualTo("PUBLISHED");
    assertThat(completed.items()).allMatch(i->Set.of("PUBLISHED","EXISTING").contains(i.state()));
    assertThat(jdbc.queryForObject("select count(*) from bb_official_image_lookup",Long.class)).isEqualTo(2);

    when(finder.find(any())).thenReturn(Optional.of(new OfficialImageCandidateFinder.Candidate(
        "https://www.example.test/item/900001","https://images.example.test/900001.jpg","item+packaging")));
    var selected=imageWorker.claim();
    assertThat(selected).isNotNull();
    imageWorker.lookup(selected);
    assertThat(jdbc.queryForObject("select candidate_url from bb_official_image_lookup where id=cast(? as uuid)",String.class,selected.id()))
        .isEqualTo("https://images.example.test/900001.jpg");

    var failing=imageWorker.claim();
    assertThat(failing).isNotNull();
    when(finder.find(any())).thenThrow(new IllegalStateException("synthetic source offline"));
    assertThatThrownBy(()->imageWorker.lookup(failing)).isInstanceOf(IllegalStateException.class);
    imageWorker.complete(failing,"NOT_FOUND",null,null,null,"official_image.unavailable");
    assertThat(products.findById(failing.product()).orElseThrow().getVisibilityStatus()).isEqualTo(ProductVisibility.PUBLIC);

    authenticate(9191L);
    assertThatThrownBy(()->service.get(batch)).hasMessageContaining("quick_publish.not_found");
    authenticate(owner);
    assertThat(service.create(request,supplier,"JP").id()).isEqualTo(batch);
  }

  private String ownedCreate(String request) {
    authenticate(owner);
    try{return service.create(request,supplier,"JP").id();}
    finally{SecurityContextHolder.clearContext();}
  }
  private void authenticate(long id) {
    var user=users.findById(id).orElseGet(()->users.saveAndFlush(new User(id,"rapid-owner-"+id,Role.AGENT,0)));
    var principal=new BobbuyAuthenticatedUser(user.getId(),user.getUsername(),user.getName(),user.getRoles());
    SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal,null,List.of(new SimpleGrantedAuthority("ROLE_AGENT"))));
  }
  private String insertItem(String batch,String key,CostcoOnboardingJob job) throws Exception {
    String item=UUID.randomUUID().toString();
    jdbc.update("insert into bb_costco_onboarding_job(id,merchant_id,supplier_id,market,idempotency_key,input_hash,revision,state,payload) values(?,?,?,?,?,?,?,?,cast(? as jsonb))",job.id(),owner,supplier,"JP",job.idempotencyKey(),job.inputHash(),job.revision(),job.state().name(),json.writeValueAsString(job));
    jdbc.update("insert into bb_photo_publish_item(id,batch_id,merchant_id,request_key,onboarding_job_id) values(cast(? as uuid),cast(? as uuid),?,?,?)",item,batch,owner,key,job.id());
    return item;
  }
  private CostcoOnboardingJob acceptedJob(String number,boolean complete) {
    String id=UUID.randomUUID().toString(),hash="a".repeat(64);
    var names=Map.of("ja-JP","合成商品 "+number,"zh-CN","合成商品 "+number,"zh-TW","合成商品 "+number,"en-US","Synthetic product "+number);
    var specs=complete?Map.of("ja-JP","2個","zh-CN","2件","zh-TW","2件","en-US","2 pack"):Map.<String,String>of("ja-JP","2個");
    var descriptions=complete?Map.of("ja-JP","試験専用商品","zh-CN","仅测试","zh-TW","僅測試","en-US","Test only"):Map.<String,String>of();
    var candidate=new CostcoOnboardingDecision.Candidate(number,"TEST",names.get("ja-JP"),null,"2 pack","2 pack",null,names,List.of(),List.of(),null,null,new CostcoOnboardingDecision.ArchiveDetails("試験専用","rapid-test-category",StorageCondition.AMBIENT),specs,descriptions);
    var trace=new CostcoOnboardingDecision.EngineTrace("b".repeat(64),"c".repeat(64),1L,1L,1L,Map.of());
    var decision=new CostcoOnboardingDecision(CostcoOnboardingDecision.Stage.ADMISSION,CostcoOnboardingDecision.Verdict.ACCEPT,"synthetic-integration","fixture",URI.create("https://ai.invalid.test/v1"),hash,List.of(),"fixture","fixture","Synthetic test decision",number,candidate,trace);
    return new CostcoOnboardingJob(id,CostcoEvidencePersistence.hash(id.getBytes()),owner,supplier,"JP",hash,number,"d".repeat(64),1,CostcoOnboardingJob.State.NEEDS_INPUT,List.of(),List.of(decision),null,null,complete?"photo.confirm_required":"photo.incomplete",Instant.now());
  }
  private void replaceJob(String id,String number,boolean complete) throws Exception {
    var replacement=acceptedJob(number,complete);
    var current=json.readValue(jdbc.queryForObject("select cast(payload as text) from bb_costco_onboarding_job where id=?",String.class,id),CostcoOnboardingJob.class);
    replacement=new CostcoOnboardingJob(current.id(),current.idempotencyKey(),current.merchantId(),current.supplierId(),current.market(),current.inputHash(),number,current.privatePhotoSha256(),current.revision(),CostcoOnboardingJob.State.NEEDS_INPUT,current.evidence(),replacement.decisions(),null,null,"photo.confirm_required",Instant.now(),current.packagingPhotoSha256());
    jdbc.update("update bb_costco_onboarding_job set state='NEEDS_INPUT',payload=cast(? as jsonb),revision=? where id=?",json.writeValueAsString(replacement),replacement.revision(),id);
  }
  private String expectedProductId(String item) {
    return UUID.nameUUIDFromBytes(("manual-product:"+owner+":"+item).getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString();
  }
}
