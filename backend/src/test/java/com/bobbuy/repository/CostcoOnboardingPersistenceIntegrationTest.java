package com.bobbuy.repository;

import com.bobbuy.api.BobbuyApplication;
import com.bobbuy.model.CostcoOnboardingJob;
import com.bobbuy.model.Role;
import com.bobbuy.model.User;
import com.bobbuy.service.CostcoEvidencePersistence;
import com.bobbuy.service.CostcoNumberOnboardingService;
import com.bobbuy.service.CostcoOfficialEvidence;
import com.bobbuy.service.CostcoOfficialEvidenceFetcher;
import com.bobbuy.service.CostcoOnboardingDecision;
import com.bobbuy.service.CostcoOnboardingQuotaException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import javax.sql.DataSource;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import static com.bobbuy.model.CostcoOnboardingJob.State.*;
import static com.bobbuy.service.CostcoOnboardingDecision.*;
import static org.junit.jupiter.api.Assertions.*;

/** Real PG SQL/JSONB/transactions only, using the existing ephemeral hosted-CI service.
 * No mocks, seed/deleteAll, alternate DB, worker, model, HTTP or product operations.
 * Disabled in ordinary/local test runs; the guard executes before context/data-source startup.
 */
@EnabledIfEnvironmentVariable(named="BOBBUY_ISOLATED_CI_POSTGRES", matches="true")
@DataJpaTest(properties={"spring.jpa.hibernate.ddl-auto=validate","spring.flyway.enabled=true",
        "bobbuy.ai.costco.worker.enabled=false","bobbuy.ai.costco.quota.pending=2",
        "bobbuy.ai.costco.quota.daily=3","bobbuy.ai.costco.quota.evidence-bytes=8388608",
        "spring.datasource.hikari.maximum-pool-size=4","spring.datasource.hikari.data-source-properties.socketTimeout=10"})
@AutoConfigureTestDatabase(replace=AutoConfigureTestDatabase.Replace.NONE)
@ContextConfiguration(classes=BobbuyApplication.class)
@Import({JdbcCostcoOnboardingJobRepository.class,CostcoEvidencePersistence.class,
        CostcoOnboardingPersistenceIntegrationTest.JsonConfiguration.class})
@Transactional(propagation=Propagation.NOT_SUPPORTED)
@Execution(ExecutionMode.SAME_THREAD)
@ResourceLock("bobuy-isolated-ci-postgres-costco")
class CostcoOnboardingPersistenceIntegrationTest {
    private static final String CI_URL="jdbc:postgresql://127.0.0.1:5432/bobbuy";
    private static final int CAPACITY=8*1024*1024;
    @TestConfiguration(proxyBeanMethods=false)
    static class JsonConfiguration { @Bean ObjectMapper persistenceJson(){return new ObjectMapper().findAndRegisterModules();} }
    @DynamicPropertySource static void isolatedCiDatasourceOnly(DynamicPropertyRegistry properties){
        if(!"true".equals(System.getenv("BOBBUY_ISOLATED_CI_POSTGRES"))
                ||!"true".equals(System.getenv("GITHUB_ACTIONS"))||!"true".equals(System.getenv("CI"))
                ||!"sunshaoxuan/bobuy".equalsIgnoreCase(System.getenv("GITHUB_REPOSITORY"))
                ||!CI_URL.equals(System.getProperty("spring.datasource.url")))
            throw new IllegalStateException("R13 persistence tests require the exact existing ephemeral hosted-CI PostgreSQL service");
        properties.add("spring.datasource.url",()->CI_URL);
        properties.add("spring.datasource.driver-class-name",()->"org.postgresql.Driver");
        properties.add("spring.jpa.hibernate.ddl-auto",()->"validate");
        properties.add("spring.flyway.enabled",()->"true");
    }
    @Autowired DataSource dataSource;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired JdbcCostcoOnboardingJobRepository jobs;
    @Autowired CostcoEvidencePersistence evidence;
    @Autowired ObjectMapper json;
    @Autowired PlatformTransactionManager transactionManager;
    private final List<Long> ownedActors=new ArrayList<>();
    private long owner;
    private TransactionTemplate transaction;
    @BeforeEach void createOnlyOwnedSyntheticActor() throws Exception {
        try(var connection=dataSource.getConnection()){
            if(!CI_URL.equals(connection.getMetaData().getURL())||!"PostgreSQL".equals(connection.getMetaData().getDatabaseProductName())
                    ||!"bobbuy".equals(connection.getCatalog())||!"bobbuy".equals(connection.getMetaData().getUserName()))
                throw new IllegalStateException("Unexpected datasource; no synthetic writes are allowed");
        }
        transaction=new TransactionTemplate(transactionManager);transaction.setTimeout(10);
        assertEquals("jsonb",jdbc.queryForObject("select data_type from information_schema.columns where table_schema=current_schema() and table_name='bb_costco_onboarding_job' and column_name='attempt_history'",String.class));
        owner=actor();
    }
    @AfterEach void removeOnlyThisTestsSyntheticRows(){
        if(transaction==null||ownedActors.isEmpty())return;
        transaction.executeWithoutResult(status->{for(long id:ownedActors){
            jdbc.update("delete from bb_costco_onboarding_commit where merchant_id=?",id);
            jdbc.update("delete from bb_costco_onboarding_job where merchant_id=?",id);
            jdbc.update("delete from bb_costco_onboarding_evidence where merchant_id=?",id);
            users.deleteById(id);
        }users.flush();});
    }
    private long actor(){
        long id=UUID.randomUUID().getMostSignificantBits()&Long.MAX_VALUE;if(id==0)id=1;
        var value=new User();value.setId(id);value.setName("R13 isolated CI actor");value.setUsername("r13-ci-"+UUID.randomUUID());value.setEnabled(true);value.setRoles(Set.of(Role.AGENT));
        transaction.executeWithoutResult(status->users.saveAndFlush(value));ownedActors.add(id);return id;
    }
    private static Instant now(){return Instant.now().truncatedTo(ChronoUnit.MICROS);}
    private static String hash(String text){return CostcoEvidencePersistence.hash(text.getBytes(StandardCharsets.UTF_8));}
    private CostcoOnboardingJob queued(long merchant,String intent){
        return new CostcoOnboardingJob(UUID.randomUUID().toString(),hash(merchant+":"+intent),merchant,"r13-ci-supplier","JP",hash(merchant+":input:"+intent),"0014110",null,0,QUEUED,List.of(),List.of(),null,null,null,now());
    }
    private CostcoOfficialEvidence receipt(String id,byte[] bytes){
        return new CostcoOfficialEvidence(id,URI.create("https://example.invalid/r13-ci/document"),URI.create("https://example.invalid/r13-ci/document"),CostcoEvidencePersistence.hash(bytes),now(),"text/html",null,null,List.of());
    }
    private void putDocument(long merchant,String input,CostcoOfficialEvidence receipt,byte[] bytes){
        evidence.put(new CostcoOfficialEvidenceFetcher.Query(merchant,"r13-ci-supplier","JP","0014110",null,input),receipt,bytes);
    }
    private CostcoOnboardingJob traced(CostcoOnboardingJob previous,CostcoOnboardingJob.State state,int attempt,List<CostcoOfficialEvidence> receipts){
        var trace=new EngineTrace(hash("input-"+attempt),hash("output-"+attempt),37+attempt,100L+attempt,attempt==2?null:40L+attempt,Map.of());
        var decision=new CostcoOnboardingDecision(Stage.INTAKE,Verdict.ACCEPT,"PG-fixture-not-live","synthetic-model",CostcoNumberOnboardingService.REQUIRED_NODE,previous.inputHash(),receipts.stream().map(CostcoOfficialEvidence::sha256).toList(),"ci-policy","ci-prompt","Synthetic persistence fixture","0014110",null,trace);
        return new CostcoOnboardingJob(previous.id(),previous.idempotencyKey(),previous.merchantId(),previous.supplierId(),previous.market(),previous.inputHash(),previous.itemNumber(),previous.privatePhotoSha256(),previous.revision()+1,state,receipts,List.of(decision),null,null,"onboarding.stage_failed",now());
    }
    private void eligible(String id){jdbc.update("update bb_costco_onboarding_job set lease_until=?,next_run_at=? where id=? and merchant_id=?",Timestamp.from(now().minusSeconds(2)),Timestamp.from(now().minusSeconds(3600)),id,owner);}
    private CostcoOnboardingJobRepository.Lease claim(String id){
        jdbc.update("update bb_costco_onboarding_job set next_run_at=? where id=? and merchant_id=?",Timestamp.from(now().minusSeconds(3600)),id,owner);
        var result=jobs.claimNext(now()).orElseThrow();assertEquals(id,result.job().id());return result;
    }
    private JsonNode history(String id) throws Exception{return json.readTree(jdbc.queryForObject("select cast(attempt_history as text) from bb_costco_onboarding_job where id=? and merchant_id=?",String.class,id,owner));}
    private void assertTrace(JsonNode payload,int attempt){var trace=payload.path("decisions").get(0).path("trace");assertEquals(hash("input-"+attempt),trace.path("inputRef").asText());assertEquals(hash("output-"+attempt),trace.path("outputRef").asText());assertEquals(100+attempt,trace.path("promptTokens").asLong());if(attempt==2)assertTrue(trace.path("completionTokens").isNull());else assertEquals(40+attempt,trace.path("completionTokens").asLong());}
    private static final class DeliberateRollback extends RuntimeException {}

    @Test void realJsonbEvidenceAndJdbcJpaTransactionsRoundTripAndRollbackTogether() throws Exception {
        var q=jobs.createOrGet(queued(owner,"roundtrip"));assertEquals(q,jobs.findOwned(q.id(),owner).orElseThrow());
        byte[] original="Synthetic R13 PG document — no official claim".getBytes(StandardCharsets.UTF_8);var document=receipt("doc",original);putDocument(owner,q.inputHash(),document,original);putDocument(owner,q.inputHash(),document,original);
        assertArrayEquals(original,evidence.readVerified(owner,document.sha256()));assertEquals(1L,jdbc.queryForObject("select count(*) from bb_costco_onboarding_evidence where merchant_id=?",Long.class,owner));
        long other=actor();assertTrue(jobs.findOwned(q.id(),other).isEmpty());assertThrows(IllegalArgumentException.class,()->evidence.readVerified(other,document.sha256()));
        var image=new BufferedImage(2,2,BufferedImage.TYPE_INT_RGB);var encoded=new ByteArrayOutputStream();assertTrue(javax.imageio.ImageIO.write(image,"png",encoded));byte[] photo=encoded.toByteArray();String photoHash=evidence.putPrivatePhoto(owner,photo);assertEquals(CostcoEvidencePersistence.hash(photo),photoHash);assertArrayEquals(photo,evidence.readVerified(owner,photoHash));
        var rollback=queued(owner,"rollback-created");byte[] rolledBytes="Synthetic rollback document".getBytes(StandardCharsets.UTF_8);var rolledReceipt=receipt("rollback",rolledBytes);
        assertThrows(DeliberateRollback.class,()->transaction.executeWithoutResult(status->{jobs.createOrGet(rollback);putDocument(owner,rollback.inputHash(),rolledReceipt,rolledBytes);throw new DeliberateRollback();}));
        assertTrue(jobs.findOwned(rollback.id(),owner).isEmpty());assertEquals(0L,jdbc.queryForObject("select count(*) from bb_costco_onboarding_evidence where merchant_id=? and sha256=?",Long.class,owner,rolledReceipt.sha256()));
        var lease=claim(q.id());var changed=traced(lease.job(),AI_REVIEW,1,List.of(document));
        assertThrows(DeliberateRollback.class,()->jobs.withLease(lease,()->transaction.execute(status->{assertTrue(jobs.compareAndSet(lease.job(),changed));throw new DeliberateRollback();})));
        assertEquals(lease.job(),jobs.findOwned(q.id(),owner).orElseThrow());assertFalse(jobs.compareAndSet(lease.job(),changed));
    }
    @Test void retryAndCrashReclaimPreserveThreeActualJsonbAttemptSnapshotsAndFenceOldLeases() throws Exception {
        var q=jobs.createOrGet(queued(owner,"history"));byte[] bytes="Synthetic retained source".getBytes(StandardCharsets.UTF_8);var document=receipt("history-doc",bytes);putDocument(owner,q.inputHash(),document,bytes);
        var first=claim(q.id());var firstState=traced(first.job(),AI_REVIEW,1,List.of(document));assertTrue(jobs.withLease(first,()->jobs.compareAndSet(first.job(),firstState)));
        Instant previousUpdated=jdbc.queryForObject("select updated_at from bb_costco_onboarding_job where id=?",Timestamp.class,q.id()).toInstant();eligible(q.id());var second=claim(q.id());
        var firstHistory=history(q.id());assertEquals(1,firstHistory.size());assertEquals(1,firstHistory.get(0).path("attempt").asInt());assertTrace(firstHistory.get(0).path("payload"),1);assertEquals(previousUpdated,OffsetDateTime.parse(firstHistory.get(0).path("lastUpdatedAt").asText()).toInstant());
        assertTrue(second.job().decisions().isEmpty());assertTrue(second.job().evidence().isEmpty());assertFalse(jobs.withLease(first,()->jobs.compareAndSet(second.job(),traced(second.job(),RETRY_WAIT,99,List.of(document)))));
        jobs.release(first);assertEquals(second.token(),jdbc.queryForObject("select lease_token from bb_costco_onboarding_job where id=?",String.class,q.id()));
        var secondState=traced(second.job(),RETRY_WAIT,2,List.of(document));assertTrue(jobs.withLease(second,()->jobs.compareAndSet(second.job(),secondState)));eligible(q.id());var third=claim(q.id());
        var two=history(q.id());assertEquals(2,two.size());assertTrace(two.get(0).path("payload"),1);assertTrace(two.get(1).path("payload"),2);assertTrue(third.job().decisions().isEmpty());
        var thirdState=traced(third.job(),RETRY_WAIT,3,List.of(document));assertTrue(jobs.withLease(third,()->jobs.compareAndSet(third.job(),thirdState)));eligible(q.id());assertTrue(jobs.claimNext(now()).isEmpty());
        var exhausted=jobs.findOwned(q.id(),owner).orElseThrow();assertEquals(FAILED,exhausted.state());assertEquals("onboarding.retry_exhausted",exhausted.failureCode());var all=history(q.id());assertEquals(3,all.size());
        for(int i=0;i<3;i++){assertEquals(i+1,all.get(i).path("attempt").asInt());assertTrace(all.get(i).path("payload"),i+1);assertFalse(all.get(i).path("payload").has("attempt_history"));assertFalse(all.get(i).path("payload").has("attemptHistory"));}
        assertTrue(jobs.claimNext(now()).isEmpty());assertEquals(all,history(q.id()));
    }
    @Test void committingReclaimsOnlyForReconciliationAndDuplicateSubmissionCannotResetOrCreate() throws Exception {
        var q=jobs.createOrGet(queued(owner,"committing"));var lease=claim(q.id());var committing=traced(lease.job(),COMMITTING,1,List.of());assertTrue(jobs.withLease(lease,()->jobs.compareAndSet(lease.job(),committing)));
        jobs.createOrGet(queued(owner,"fills-pending-quota"));var duplicate=new CostcoOnboardingJob(UUID.randomUUID().toString(),q.idempotencyKey(),owner,q.supplierId(),q.market(),q.inputHash(),q.itemNumber(),null,0,QUEUED,List.of(),List.of(),null,null,null,now());
        assertEquals(committing,jobs.createOrGet(duplicate));assertEquals(1L,jdbc.queryForObject("select count(*) from bb_costco_onboarding_job where merchant_id=? and idempotency_key=?",Long.class,owner,q.idempotencyKey()));
        for(int i=0;i<3;i++){eligible(q.id());var reclaimed=claim(q.id());assertEquals(committing,reclaimed.job());assertEquals(0,history(q.id()).size());jobs.release(reclaimed);assertNull(jdbc.queryForObject("select lease_token from bb_costco_onboarding_job where id=?",String.class,q.id()));}
        assertEquals(COMMITTING,jobs.findOwned(q.id(),owner).orElseThrow().state());assertEquals(4,jdbc.queryForObject("select attempts from bb_costco_onboarding_job where id=?",Integer.class,q.id()));
    }
    private <T> List<T> simultaneous(Callable<T> first,Callable<T> second) throws Exception {
        var ready=new CountDownLatch(2);var go=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(2);
        try{var a=pool.submit(()->{ready.countDown();if(!go.await(5,TimeUnit.SECONDS))throw new IllegalStateException("CI start barrier expired");return first.call();});var b=pool.submit(()->{ready.countDown();if(!go.await(5,TimeUnit.SECONDS))throw new IllegalStateException("CI start barrier expired");return second.call();});assertTrue(ready.await(5,TimeUnit.SECONDS));go.countDown();return List.of(a.get(10,TimeUnit.SECONDS),b.get(10,TimeUnit.SECONDS));}
        finally{go.countDown();pool.shutdownNow();assertTrue(pool.awaitTermination(10,TimeUnit.SECONDS));}
    }
    @Test void concurrentSameIntentUsesOneRealRowAndPreservesOwnerIsolation() throws Exception {
        var a=queued(owner,"same-intent");var b=new CostcoOnboardingJob(UUID.randomUUID().toString(),a.idempotencyKey(),owner,a.supplierId(),a.market(),a.inputHash(),a.itemNumber(),null,0,QUEUED,List.of(),List.of(),null,null,null,now());
        var results=simultaneous(()->jobs.createOrGet(a),()->jobs.createOrGet(b));assertEquals(results.get(0),results.get(1));assertEquals(1L,jdbc.queryForObject("select count(*) from bb_costco_onboarding_job where merchant_id=?",Long.class,owner));
        long other=actor();var foreign=jobs.createOrGet(queued(other,"same-intent"));assertNotEquals(results.get(0).id(),foreign.id());assertTrue(jobs.findOwned(results.get(0).id(),other).isEmpty());
    }
    @Test void actualOwnerRowLockMakesPendingBudgetAtomicAcrossIndependentTransactions() throws Exception {
        jobs.createOrGet(queued(owner,"already-pending"));var a=queued(owner,"quota-a");var b=queued(owner,"quota-b");
        Callable<String> first=()->{try{jobs.createOrGet(a);return "created";}catch(CostcoOnboardingQuotaException e){assertEquals("onboarding.pending_quota",e.getMessage());return "quota";}};
        Callable<String> second=()->{try{jobs.createOrGet(b);return "created";}catch(CostcoOnboardingQuotaException e){assertEquals("onboarding.pending_quota",e.getMessage());return "quota";}};
        var results=simultaneous(first,second);assertEquals(1,results.stream().filter("created"::equals).count());assertEquals(1,results.stream().filter("quota"::equals).count());assertEquals(2L,jdbc.queryForObject("select count(*) from bb_costco_onboarding_job where merchant_id=?",Long.class,owner));
    }
    @Test void actualByteaEvidenceBudgetIsOwnerScopedAndSameHashRetryDoesNotConsumeCapacity(){
        byte[] full=new byte[CAPACITY];Arrays.fill(full,(byte)'s');var receipt=receipt("capacity",full);putDocument(owner,hash("capacity-input"),receipt,full);putDocument(owner,hash("capacity-input"),receipt,full);
        assertEquals((long)CAPACITY,jdbc.queryForObject("select sum(octet_length(content)) from bb_costco_onboarding_evidence where merchant_id=?",Long.class,owner));
        byte[] extra="new synthetic evidence".getBytes(StandardCharsets.UTF_8);var extraReceipt=receipt("extra",extra);assertThrows(CostcoOnboardingQuotaException.class,()->putDocument(owner,hash("capacity-input"),extraReceipt,extra));assertEquals(1L,jdbc.queryForObject("select count(*) from bb_costco_onboarding_evidence where merchant_id=?",Long.class,owner));
        long other=actor();putDocument(other,hash("other-input"),extraReceipt,extra);assertArrayEquals(extra,evidence.readVerified(other,extraReceipt.sha256()));assertEquals(1L,jdbc.queryForObject("select count(*) from bb_costco_onboarding_evidence where merchant_id=?",Long.class,other));
    }
}
