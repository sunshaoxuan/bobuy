package com.bobbuy.service;

import com.bobbuy.model.CostcoOnboardingJob;
import com.bobbuy.repository.CostcoOnboardingJobRepository;
import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BiFunction;
import org.junit.jupiter.api.Test;
import static com.bobbuy.model.CostcoOnboardingJob.State.*;
import static com.bobbuy.service.CostcoOnboardingDecision.*;
import static org.junit.jupiter.api.Assertions.*;

/** Deterministic unit fixtures only: no live model, retrieval, DB, product writes or official facts. */
class CostcoNumberOnboardingServiceTest {
    private static final Instant NOW = Instant.parse("2026-11-09T09:00:00Z");
    private static final String REQUEST = "00000000-0000-0000-0000-000000000001";
    private static final String IMAGE = "a".repeat(64);
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final class MemoryJobs implements CostcoOnboardingJobRepository {
        final Map<String, CostcoOnboardingJob> byId = new HashMap<>();
        final Map<String, String> byKey = new HashMap<>();
        boolean failNextCas;
        public synchronized CostcoOnboardingJob createOrGet(CostcoOnboardingJob q) {
            var id = byKey.get(q.idempotencyKey());
            if (id != null) return byId.get(id);
            byKey.put(q.idempotencyKey(), q.id()); byId.put(q.id(), q); return q;
        }
        public synchronized Optional<CostcoOnboardingJob> findOwned(String id, long merchant) {
            return Optional.ofNullable(byId.get(id)).filter(j -> j.merchantId() == merchant);
        }
        public synchronized boolean compareAndSet(CostcoOnboardingJob expected, CostcoOnboardingJob next) {
            if (failNextCas) { failNextCas = false; return false; }
            var current = byId.get(expected.id());
            if (!expected.equals(current) || next.revision() != expected.revision() + 1 || next.merchantId() != expected.merchantId()) return false;
            byId.put(next.id(), next); return true;
        }
    }
    private static final class Fixture {
        final MemoryJobs repo = new MemoryJobs();
        final AtomicInteger reviews = new AtomicInteger(), fetches = new AtomicInteger(), saves = new AtomicInteger();
        List<CostcoOfficialEvidence> evidence = List.of(image(NOW));
        BiFunction<Stage, CostcoOnboardingJob, CostcoOnboardingDecision> decide = (stage, job) -> decision(stage, Verdict.ACCEPT, job);
        boolean uncertainSave, mismatchedReceipt;
        Candidate captured;
        CostcoNumberOnboardingService service() {
            return new CostcoNumberOnboardingService(repo, query -> { fetches.incrementAndGet(); return evidence; },
                (stage, job) -> { reviews.incrementAndGet(); return decide.apply(stage, job); },
                (job, candidate, hash) -> {
                    saves.incrementAndGet(); captured = candidate;
                    if (uncertainSave) throw new IllegalStateException("simulated_lost_commit_response");
                    return new CostcoNumberOnboardingService.CommitReceipt(job.idempotencyKey(), mismatchedReceipt ? "b".repeat(64) : hash, "synthetic-product", 7, true);
                }, CLOCK);
        }
    }
    private static CostcoOfficialEvidence image(Instant at) {
        return new CostcoOfficialEvidence("synthetic-image", URI.create("https://example.test/canonical"),
            URI.create("https://example.test/image.png"), IMAGE, at, "image/png", 1600, 1200, List.of());
    }
    private static Candidate candidate(String item) {
        return new Candidate(item, "Synthetic brand", "Synthetic item", "M-1", "80 g", "80 × 2", IMAGE, Map.of(), List.of());
    }
    private static CostcoOnboardingDecision decision(Stage stage, Verdict verdict, CostcoOnboardingJob job) {
        return new CostcoOnboardingDecision(stage, verdict, "unit-fixture-not-live", "fixture-model",
            CostcoNumberOnboardingService.REQUIRED_NODE, job.inputHash(), job.evidence().stream().map(CostcoOfficialEvidence::sha256).toList(),
            "unit-policy-v1", "unit-prompt-v1", "Deterministic unit fixture only", "0014110", stage == Stage.ADMISSION ? candidate("0014110") : null);
    }
    private static CostcoNumberOnboardingService.Input input(long merchant, long supplier, String market, String number, String photo) {
        return new CostcoNumberOnboardingService.Input(merchant, Long.toString(supplier), market, REQUEST, number, photo);
    }
    @Test void normalizesProtocolOnlyAndRetainsLeadingZeroes() {
        assertEquals("0014110", CostcoNumberOnboardingService.normalizeItemNumber(" ００１４１１０ "));
        for (var invalid : List.of("14110,77839", "1e5", "14110 77839", "ITEM 14110", "", "-14110", "1234567890123"))
            assertThrows(IllegalArgumentException.class, () -> CostcoNumberOnboardingService.normalizeItemNumber(invalid));
    }
    @Test void requiresExactlyOneInputAndVerifiedPhotoReceiptShape() {
        assertThrows(IllegalArgumentException.class, () -> input(1, 2, "JP", null, null));
        assertThrows(IllegalArgumentException.class, () -> input(1, 2, "JP", "14110", IMAGE));
        assertThrows(IllegalArgumentException.class, () -> input(1, 2, "JP", null, "not-a-sha"));
        assertThrows(IllegalArgumentException.class, () -> input(0, 2, "JP", "14110", null));
        assertThrows(IllegalArgumentException.class, () -> input(1, 2, "jp", "14110", null));
    }
    @Test void reusesSameIntentAndRejectsDifferentPayloadUnderSameKey() {
        var f = new Fixture(); var service = f.service();
        var first = service.enqueue(input(1, 2, "JP", "0014110", null));
        assertEquals(first, service.enqueue(input(1, 2, "JP", "００１４１１０", null)));
        assertThrows(IllegalStateException.class, () -> service.enqueue(input(1, 2, "JP", "77839", null)));
        assertEquals(1, f.repo.byId.size()); assertEquals(0, f.reviews.get());
    }
    @Test void merchantSupplierAndMarketAreDistinctAndOwnerCannotReadAnotherJob() {
        var f = new Fixture(); var s = f.service(); var a = s.enqueue(input(1, 2, "JP", "0014110", null));
        assertNotEquals(a.id(), s.enqueue(input(2, 2, "JP", "0014110", null)).id());
        assertNotEquals(a.id(), s.enqueue(input(1, 3, "JP", "0014110", null)).id());
        assertNotEquals(a.id(), s.enqueue(input(1, 2, "US", "0014110", null)).id());
        assertThrows(IllegalArgumentException.class, () -> s.execute(a.id(), 2, 0));
        assertEquals(0, f.reviews.get());
    }
    @Test void numberAndPhotoUseTheSameFiveStagesAndReopenReceiptBeforeCompletion() {
        for (boolean photo : List.of(false, true)) {
            var f = new Fixture(); var s = f.service(); var q = s.enqueue(input(1, 2, "JP", photo ? null : "0014110", photo ? "b".repeat(64) : null));
            if(photo)f.decide=(stage,job)->{var d=decision(stage,Verdict.ACCEPT,job);if(stage!=Stage.ADMISSION)return d;var c=d.candidate();return new CostcoOnboardingDecision(d.stage(),d.verdict(),d.provider(),d.model(),d.endpoint(),d.inputHash(),d.evidenceHashes(),d.policyVersion(),d.promptVersion(),d.reason(),d.identifiedItemNumber(),new Candidate(c.itemNumber(),null,c.name(),c.model(),c.specification(),c.packaging(),c.officialImageSha256(),c.translatedNames(),c.unknownFields()));};
            var done = s.execute(q.id(), 1, 0);
            assertEquals(COMPLETED, done.state()); assertEquals("0014110", done.itemNumber());
            assertEquals(List.of(Stage.INTAKE, Stage.IDENTITY, Stage.FACTS, Stage.IMAGE_SOURCE, Stage.ADMISSION), done.decisions().stream().map(CostcoOnboardingDecision::stage).toList());
            assertEquals("80 × 2", f.captured.packaging()); assertEquals(1, f.saves.get());
            if(photo)assertNull(f.captured.brand());
            assertEquals(done, s.execute(q.id(), 1, 0)); assertEquals(1, f.saves.get());
        }
    }
    @Test void nonAcceptSemanticDecisionsNeverBecomeSuccessfulImports() {
        for (var verdict : List.of(Verdict.NEEDS_EVIDENCE, Verdict.AMBIGUOUS, Verdict.REJECT)) {
            var f = new Fixture(); f.decide = (stage, job) -> decision(stage, stage == Stage.IDENTITY ? verdict : Verdict.ACCEPT, job);
            var s = f.service(); var q = s.enqueue(input(1, 2, "JP", "0014110", null));
            var result = s.execute(q.id(), 1, 0);
            assertEquals(verdict == Verdict.REJECT ? FAILED : NEEDS_INPUT, result.state());
            assertNull(result.productId()); assertEquals(0, f.saves.get());
        }
    }
    @Test void missingAndStaleEvidenceDoNotReachCatalog() {
        for (var evidence : List.of(List.<CostcoOfficialEvidence>of(), List.of(image(NOW.minusSeconds(86401))), List.of(image(NOW.plusSeconds(1))))) {
            var f = new Fixture(); f.evidence = evidence; var s = f.service(); var q = s.enqueue(input(1, 2, "JP", "0014110", null));
            assertNotEquals(COMPLETED, s.execute(q.id(), 1, 0).state()); assertEquals(0, f.saves.get());
        }
    }
    @Test void rejectsWrongNodeInputAndEvidenceBindings() {
        for (var mutation : List.of("node", "input", "evidence", "stage")) {
            var f = new Fixture(); f.decide = (stage, job) -> {
                var d = decision(stage, Verdict.ACCEPT, job);
                return new CostcoOnboardingDecision(mutation.equals("stage") ? Stage.ADMISSION : stage, d.verdict(), d.provider(), d.model(),
                    mutation.equals("node") ? URI.create("https://example.test/v1") : d.endpoint(),
                    mutation.equals("input") ? "f".repeat(64) : d.inputHash(), mutation.equals("evidence") ? List.of("c".repeat(64)) : d.evidenceHashes(),
                    d.policyVersion(), d.promptVersion(), d.reason(), d.identifiedItemNumber(), d.candidate());
            };
            var s = f.service(); var q = s.enqueue(input(1, 2, "JP", "0014110", null));
            assertEquals(RETRY_WAIT, s.execute(q.id(), 1, 0).state()); assertEquals(0, f.fetches.get()); assertEquals(0, f.saves.get());
        }
    }
    @Test void uncertaintyOrWrongSaveReceiptStaysCommittingWithoutASecondCreate() {
        for (boolean uncertain : List.of(false, true)) {
            var f = new Fixture(); f.uncertainSave = uncertain; f.mismatchedReceipt = !uncertain;
            var s = f.service(); var q = s.enqueue(input(1, 2, "JP", "0014110", null));
            assertThrows(IllegalStateException.class, () -> s.execute(q.id(), 1, 0));
            var actual = f.repo.findOwned(q.id(), 1).orElseThrow(); assertEquals(COMMITTING, actual.state()); assertNull(actual.productId());
            assertThrows(IllegalStateException.class, () -> s.execute(q.id(), 1, actual.revision())); assertEquals(1, f.saves.get());
        }
    }
    @Test void failedClaimDoesNotRunAnyExternalPort() {
        var f = new Fixture(); var s = f.service(); var q = s.enqueue(input(1, 2, "JP", "0014110", null)); f.repo.failNextCas = true;
        assertThrows(IllegalStateException.class, () -> s.execute(q.id(), 1, 0));
        assertEquals(0, f.reviews.get()); assertEquals(0, f.fetches.get()); assertEquals(0, f.saves.get());
        assertEquals(QUEUED, f.repo.findOwned(q.id(), 1).orElseThrow().state());
    }
    @Test void duplicateConcurrentExecuteCannotRunTheSameStageTwice() throws Exception {
        var f = new Fixture(); var entered = new CountDownLatch(1); var release = new CountDownLatch(1); var errors = new ArrayList<Throwable>();
        f.decide = (stage, job) -> {
            if (stage == Stage.INTAKE) { entered.countDown(); try { if (!release.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("timeout"); } catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new IllegalStateException(e); } }
            return decision(stage, Verdict.ACCEPT, job);
        };
        var s = f.service(); var q = s.enqueue(input(1, 2, "JP", "0014110", null));
        var first = new Thread(() -> { try { s.execute(q.id(), 1, 0); } catch (Throwable e) { errors.add(e); } }); first.start();
        try { assertTrue(entered.await(5, TimeUnit.SECONDS)); assertThrows(IllegalStateException.class, () -> s.execute(q.id(), 1, 0)); }
        finally { release.countDown(); first.join(5000); }
        assertFalse(first.isAlive()); assertTrue(errors.isEmpty(), errors.toString()); assertEquals(5, f.reviews.get()); assertEquals(1, f.saves.get());
    }
    @Test void candidateHashBindsPackagingAndIgnoresTranslationMapInsertionOrder() {
        var a = candidate("0014110"); var map = new java.util.LinkedHashMap<String, String>(); map.put("en", "A"); map.put("ja", "B");
        var b = new Candidate(a.itemNumber(), a.brand(), a.name(), a.model(), a.specification(), a.packaging(), IMAGE, map, List.of());
        var reverse = new java.util.LinkedHashMap<String, String>(); reverse.put("ja", "B"); reverse.put("en", "A");
        assertEquals(CostcoNumberOnboardingService.candidateHash(b), CostcoNumberOnboardingService.candidateHash(new Candidate(a.itemNumber(), a.brand(), a.name(), a.model(), a.specification(), a.packaging(), IMAGE, reverse, List.of())));
        assertNotEquals(CostcoNumberOnboardingService.candidateHash(a), CostcoNumberOnboardingService.candidateHash(new Candidate(a.itemNumber(), a.brand(), a.name(), a.model(), a.specification(), "160", IMAGE, Map.of(), List.of())));
    }
    @Test void missingPinnedCapabilityNeedsInputRatherThanAnAutomaticRetryLoop() {
        var f=new Fixture();f.decide=(stage,job)->{throw new CostcoNumberOnboardingService.NeedsInput("onboarding.vision_capability_unknown");};
        var s=f.service();var q=s.enqueue(input(1,2,"JP","0014110",null));assertEquals(NEEDS_INPUT,s.execute(q.id(),1,0).state());assertEquals(0,f.fetches.get());assertEquals(0,f.saves.get());
    }
    @Test void candidateHashBindsReferenceWindowAndReviewedTarget() {
        var base=candidate("0014110");var quote=new ReferencePrice("OFFER",new java.math.BigDecimal("2572"),"JPY","WAREHOUSE",null,"pack","2026-11-09","2026-11-15","Asia/Tokyo",null,URI.create("https://example.test/product"),"c".repeat(64));
        var first=new Candidate(base.itemNumber(),base.brand(),base.name(),base.model(),base.specification(),base.packaging(),IMAGE,base.translatedNames(),List.of(),List.of(quote),new Target("target",7,"d".repeat(64)));
        var changed=new Candidate(base.itemNumber(),base.brand(),base.name(),base.model(),base.specification(),base.packaging(),IMAGE,base.translatedNames(),List.of(),List.of(quote),new Target("target",8,"d".repeat(64)));
        assertNotEquals(CostcoNumberOnboardingService.candidateHash(first),CostcoNumberOnboardingService.candidateHash(changed));
        assertNotEquals(CostcoNumberOnboardingService.candidateHash(base),CostcoNumberOnboardingService.candidateHash(first));assertNull(quote.taxStatus());
    }
    @Test void recoveredDurableCommitReceiptCompletesWithoutAnotherCreate() {
        var f=new Fixture();var attempts=new AtomicInteger();
        var catalog=new CostcoNumberOnboardingService.CatalogCommitter(){public CostcoNumberOnboardingService.CommitReceipt commitOnce(CostcoOnboardingJob job,Candidate c,String hash){attempts.incrementAndGet();throw new IllegalStateException("simulated_lost_response");}
            public Optional<CostcoNumberOnboardingService.CommitReceipt> reconcile(CostcoOnboardingJob job,String hash){return Optional.of(new CostcoNumberOnboardingService.CommitReceipt(job.idempotencyKey(),hash,"synthetic-product",7,true));}};
        var s=new CostcoNumberOnboardingService(f.repo,q->List.of(image(NOW)),(stage,j)->decision(stage,Verdict.ACCEPT,j),catalog,CLOCK);
        var q=s.enqueue(input(1,2,"JP","0014110",null));assertThrows(IllegalStateException.class,()->s.execute(q.id(),1,0));var pending=f.repo.findOwned(q.id(),1).orElseThrow();
        assertEquals(COMMITTING,pending.state());assertEquals(COMPLETED,s.reconcile(q.id(),1,pending.revision()).state());assertEquals(1,attempts.get());
    }
    @Test void revokedScopeBeforeExecutionDoesNotReachAnyExternalStage() {
        var f=new Fixture();var q=f.service().enqueue(input(1,2,"JP","0014110",null));
        var s=new CostcoNumberOnboardingService(f.repo,query->{f.fetches.incrementAndGet();return List.of();},(stage,job)->{f.reviews.incrementAndGet();return decision(stage,Verdict.ACCEPT,job);},(job,candidate,hash)->{f.saves.incrementAndGet();return null;},CLOCK,
                job->{throw new CostcoNumberOnboardingService.NeedsInput("onboarding.scope_changed");});
        assertEquals(NEEDS_INPUT,s.execute(q.id(),1,0).state());assertEquals(0,f.reviews.get());assertEquals(0,f.fetches.get());assertEquals(0,f.saves.get());
    }
}
