package com.bobbuy.service;

import com.bobbuy.model.CostcoOnboardingJob;
import com.bobbuy.repository.CostcoOnboardingJobRepository;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.Normalizer;
import java.time.Clock;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import static com.bobbuy.model.CostcoOnboardingJob.State.*;
import static com.bobbuy.service.CostcoOnboardingDecision.*;

/** Shared NUMBER/PHOTO orchestration. Ports attach to the existing photo/gateway/catalog chain.
 * No controller, scheduled worker or implicit external calls are installed by this candidate.
 */
public final class CostcoNumberOnboardingService {
    public static final URI REQUIRED_NODE = URI.create("https://ccnode.briconbric.com:49530/v1");
    public record Input(long merchantId, String supplierId, String market, String requestId,
            String itemNumber, String privatePhotoSha256) {
        public Input {
            if (merchantId <= 0 || supplierId == null || supplierId.isBlank() || supplierId.length() > 100 || market == null || !market.matches("[A-Z]{2}"))
                throw new IllegalArgumentException("onboarding.owner_scope");
            if (requestId == null || !UUID.fromString(requestId).toString().equals(requestId))
                throw new IllegalArgumentException("onboarding.request_id");
            boolean number = itemNumber != null, photo = privatePhotoSha256 != null;
            if (number == photo) throw new IllegalArgumentException("onboarding.one_input_required");
            if (number) itemNumber = normalizeItemNumber(itemNumber);
            if (photo && !privatePhotoSha256.matches("[0-9a-f]{64}")) throw new IllegalArgumentException("onboarding.photo_receipt");
        }
    }
    /** Adapter must use LlmGateway with strict node/model/vision attestation and no silent fallback.
     * The current generic generate() cannot prove that contract: its pinned adapter is pending.
     * Decisions must come from server execution; never deserialize them from the customer's request.
     */
    public interface StageReviewer {
        CostcoOnboardingDecision review(Stage stage, CostcoOnboardingJob job);
    }
    public interface ExecutionGuard { void check(CostcoOnboardingJob job); }
    public record CommitReceipt(String idempotencyKey, String candidateHash, String productId,
            long productVersion, boolean reopenedAndMatched) {}
    /** Implement via ProductCatalogService + existing media lease/outbox. Save and reopen atomically/idempotently. */
    public interface CatalogCommitter {
        CommitReceipt commitOnce(CostcoOnboardingJob job, Candidate candidate, String candidateHash);
        default java.util.Optional<CommitReceipt> reconcile(CostcoOnboardingJob job, String candidateHash) { return java.util.Optional.empty(); }
    }
    private final CostcoOnboardingJobRepository jobs;
    private final CostcoOfficialEvidenceFetcher fetcher;
    private final StageReviewer reviewer;
    private final CatalogCommitter catalog;
    private final Clock clock;
    private final ExecutionGuard guard;
    public CostcoNumberOnboardingService(CostcoOnboardingJobRepository jobs, CostcoOfficialEvidenceFetcher fetcher,
            StageReviewer reviewer, CatalogCommitter catalog, Clock clock) {
        this(jobs,fetcher,reviewer,catalog,clock,job->{});
    }
    public CostcoNumberOnboardingService(CostcoOnboardingJobRepository jobs, CostcoOfficialEvidenceFetcher fetcher,
            StageReviewer reviewer, CatalogCommitter catalog, Clock clock,ExecutionGuard guard) {
        this.jobs = Objects.requireNonNull(jobs); this.fetcher = Objects.requireNonNull(fetcher);
        this.reviewer = Objects.requireNonNull(reviewer); this.catalog = Objects.requireNonNull(catalog); this.clock = Objects.requireNonNull(clock);this.guard=Objects.requireNonNull(guard);
    }
    public CostcoOnboardingJob enqueue(Input input) {
        // Number and photo share all downstream stages; only intake identity differs.
        String identity = encode(input.market(), input.itemNumber(), input.privatePhotoSha256());
        String inputHash = hash(encode(Long.toString(input.merchantId()), input.supplierId(), identity));
        String key = hash(encode(Long.toString(input.merchantId()), input.supplierId(), input.market(), input.requestId()));
        var proposed = new CostcoOnboardingJob(UUID.randomUUID().toString(), key, input.merchantId(), input.supplierId(), input.market(), inputHash,
                input.itemNumber(), input.privatePhotoSha256(), 0, QUEUED, List.of(), List.of(), null, null, null, clock.instant());
        guard.check(proposed);
        var stored = jobs.createOrGet(proposed);
        if (!key.equals(stored.idempotencyKey()) || !inputHash.equals(stored.inputHash()) || stored.merchantId() != input.merchantId()
                || !stored.supplierId().equals(input.supplierId()) || !stored.market().equals(input.market()))
            throw new IllegalStateException("onboarding.idempotency_conflict");
        return stored;
    }
    public CostcoOnboardingJob execute(String jobId, long merchantId, long expectedRevision) {
        var job = jobs.findOwned(jobId, merchantId).orElseThrow(() -> new IllegalArgumentException("onboarding.not_found"));
        if (merchantId <= 0 || job.merchantId() != merchantId) throw new IllegalArgumentException("onboarding.not_found");
        if (job.state() == COMPLETED) return job;
        if (job.revision() != expectedRevision || job.state() != QUEUED) throw new IllegalStateException("onboarding.state_conflict");
        job = move(job, AI_INTAKE, job.itemNumber(), job.evidence(), job.decisions(), null, null, null);
        // Claim is committed before I/O. A competing execute cannot run or save the same job.
        try {
            var intake = review(Stage.INTAKE, job);
            job = append(job, intake);
            if (intake.verdict() != Verdict.ACCEPT) return stop(job, intake);
            String item = normalizeItemNumber(intake.identifiedItemNumber());
            if (job.itemNumber() != null && !job.itemNumber().equals(item))
                return move(job, NEEDS_INPUT, job.itemNumber(), job.evidence(), job.decisions(), null, null, "onboarding.item_mismatch");
            job = move(job, EVIDENCE_FETCH, item, job.evidence(), job.decisions(), null, null, null);
            guard.check(job);
            var evidence = List.copyOf(fetcher.fetch(new CostcoOfficialEvidenceFetcher.Query(merchantId, job.supplierId(), job.market(), item, job.privatePhotoSha256(), job.inputHash())));
            if (evidence.isEmpty()) return move(job, NEEDS_INPUT, item, evidence, job.decisions(), null, null, "onboarding.evidence_missing");
            if (evidence.size() > 32 || evidence.stream().map(CostcoOfficialEvidence::id).distinct().count() != evidence.size())
                throw new IllegalStateException("onboarding.evidence_protocol");
            if (evidence.stream().anyMatch(e -> e.fetchedAt().isAfter(clock.instant()) || e.fetchedAt().isBefore(clock.instant().minusSeconds(86400))))
                throw new IllegalStateException("onboarding.evidence_stale");
            job = move(job, AI_REVIEW, item, evidence, job.decisions(), null, null, null);
            Candidate candidate = null;
            for (var stage : List.of(Stage.IDENTITY, Stage.FACTS, Stage.IMAGE_SOURCE, Stage.ADMISSION)) {
                var decision = review(stage, job); job = append(job, decision);
                if (decision.verdict() != Verdict.ACCEPT) return stop(job, decision);
                if (stage == Stage.ADMISSION) candidate = decision.candidate();
            }
            if (!completeCandidate(candidate, job)) return move(job, NEEDS_INPUT, item, evidence, job.decisions(), null, null, "onboarding.candidate_incomplete");
            String candidateHash = candidateHash(candidate);
            job = move(job, COMMITTING, item, evidence, job.decisions(), null, null, null);
            CommitReceipt receipt;
            try { guard.check(job);receipt = catalog.commitOnce(job, candidate, candidateHash); }
            catch (NeedsInput missing) { return move(job, NEEDS_INPUT, item, evidence, job.decisions(), null, null, missing.getMessage()); }
            if (receipt == null || !receipt.reopenedAndMatched() || !job.idempotencyKey().equals(receipt.idempotencyKey())
                    || !candidateHash.equals(receipt.candidateHash()) || receipt.productId() == null || receipt.productId().isBlank() || receipt.productVersion() < 0)
                throw new IllegalStateException("onboarding.commit_reconciliation_required");
            return move(job, COMPLETED, item, evidence, job.decisions(), receipt.productId(), receipt.productVersion(), null);
        } catch (CostcoOnboardingQuotaException quota) {
            if(job.state()==COMMITTING)throw quota;
            return move(job, NEEDS_INPUT, job.itemNumber(), job.evidence(), job.decisions(), null, null, quota.getMessage());
        } catch (CostcoPublicEvidenceFetcher.NeedsEvidence missing) {
            return move(job, NEEDS_INPUT, job.itemNumber(), job.evidence(), job.decisions(), null, null, missing.getMessage());
        } catch (NeedsInput missing) {
            if (job.state() == COMMITTING) throw missing;
            return move(job, NEEDS_INPUT, job.itemNumber(), job.evidence(), job.decisions(), null, null, missing.getMessage());
        } catch (RuntimeException error) {
            // An uncertain save remains COMMITTING. Never blindly create another product or mark completion.
            if (job.state() == COMMITTING) throw error;
            if ("onboarding.state_conflict".equals(error.getMessage())) throw error;
            return move(job, RETRY_WAIT, job.itemNumber(), job.evidence(), job.decisions(), null, null, "onboarding.stage_failed");
        }
    }
    public static final class NeedsInput extends RuntimeException { public NeedsInput(String code) { super(code); } }
    /** An uncertain external save is only resolved by reading its durable idempotent commit receipt. */
    public CostcoOnboardingJob reconcile(String jobId, long merchantId, long expectedRevision) {
        var job = jobs.findOwned(jobId, merchantId).orElseThrow(() -> new IllegalArgumentException("onboarding.not_found"));
        if (job.merchantId() != merchantId || job.revision() != expectedRevision || job.state() != COMMITTING)
            throw new IllegalStateException("onboarding.state_conflict");
        var candidate = job.decisions().stream().filter(d -> d.stage() == Stage.ADMISSION && d.verdict() == Verdict.ACCEPT)
                .reduce((a,b) -> b).map(CostcoOnboardingDecision::candidate).orElseThrow();
        String hash = candidateHash(candidate);
        guard.check(job);var receipt = catalog.reconcile(job, hash);
        if (receipt.isEmpty()) return job;
        var r = receipt.get();
        if (!r.reopenedAndMatched() || !hash.equals(r.candidateHash()) || !job.idempotencyKey().equals(r.idempotencyKey()))
            throw new IllegalStateException("onboarding.commit_reconciliation_required");
        return move(job, COMPLETED, job.itemNumber(), job.evidence(), job.decisions(), r.productId(), r.productVersion(), null);
    }
    private CostcoOnboardingDecision review(Stage stage, CostcoOnboardingJob job) {
        guard.check(job);
        var d = reviewer.review(stage, job);
        var expected = job.evidence().stream().map(CostcoOfficialEvidence::sha256).collect(Collectors.toSet());
        if (d == null || d.stage() != stage || !REQUIRED_NODE.equals(d.endpoint()) || !job.inputHash().equals(d.inputHash())
                || !expected.equals(new java.util.HashSet<>(d.evidenceHashes()))) throw new IllegalStateException("onboarding.unattested_decision");
        return d;
    }
    private CostcoOnboardingJob append(CostcoOnboardingJob job, CostcoOnboardingDecision decision) {
        var decisions = new ArrayList<>(job.decisions()); decisions.add(decision);
        return move(job, job.state(), job.itemNumber(), job.evidence(), decisions, null, null, null);
    }
    private CostcoOnboardingJob stop(CostcoOnboardingJob job, CostcoOnboardingDecision decision) {
        return move(job, decision.verdict() == Verdict.REJECT ? FAILED : NEEDS_INPUT, job.itemNumber(), job.evidence(), job.decisions(), null, null, "onboarding." + decision.verdict().name().toLowerCase(java.util.Locale.ROOT));
    }
    private CostcoOnboardingJob move(CostcoOnboardingJob old, CostcoOnboardingJob.State state, String item,
            List<CostcoOfficialEvidence> evidence, List<CostcoOnboardingDecision> decisions, String productId, Long version, String failure) {
        var next = new CostcoOnboardingJob(old.id(), old.idempotencyKey(), old.merchantId(), old.supplierId(), old.market(), old.inputHash(), item, old.privatePhotoSha256(), old.revision() + 1, state, evidence, decisions, productId, version, failure, clock.instant());
        if (!jobs.compareAndSet(old, next)) throw new IllegalStateException("onboarding.state_conflict");
        return next;
    }
    private static boolean completeCandidate(Candidate c, CostcoOnboardingJob job) {
        return c != null && job.itemNumber().equals(c.itemNumber()) && c.name() != null && !c.name().isBlank()
                && (c.brand() == null || !c.brand().isBlank()) && c.unknownFields().isEmpty()
                && c.officialImageSha256() != null && job.evidence().stream().anyMatch(e -> e.sha256().equals(c.officialImageSha256()) && e.mediaType().startsWith("image/") && e.width() != null && e.height() != null)
                && c.referencePrices().stream().allMatch(q->job.evidence().stream().anyMatch(e->e.sha256().equals(q.sourceSha256())&&e.canonicalUrl().equals(q.sourceUrl())));
        // Pixel quality/price-free/official-source judgments belong to the real IMAGE_SOURCE and ADMISSION stages.
    }
    public static String normalizeItemNumber(String raw) {
        if (raw == null) throw new IllegalArgumentException("onboarding.item_required");
        String result = Normalizer.normalize(raw, Normalizer.Form.NFKC).strip();
        if (!result.matches("[0-9]{1,12}")) throw new IllegalArgumentException("onboarding.one_item_required");
        return result; // Preserve leading zeroes; do not infer a product from the number's length.
    }
    public static String candidateHash(Candidate c) {
        var translations = c.translatedNames().entrySet().stream().sorted(java.util.Map.Entry.comparingByKey())
                .map(e -> encode(e.getKey(), e.getValue())).collect(Collectors.joining());
        var prices=c.referencePrices().stream().map(q->encode(q.kind(),q.amount().stripTrailingZeros().toPlainString(),q.currency(),q.channel(),q.taxStatus(),q.quantityBasis(),q.validFrom(),q.validUntil(),q.timeZone(),q.conditions(),q.sourceUrl().toString(),q.sourceSha256())).sorted().collect(Collectors.joining());
        var target=c.target()==null?null:encode(c.target().productId(),Long.toString(c.target().version()),c.target().sourceHash());
        return hash(encode(c.itemNumber(), c.brand(), c.name(), c.model(), c.specification(), c.packaging(), c.officialImageSha256(), translations,prices,target));
    }
    private static String encode(String... values) {
        var out = new StringBuilder(); for (var v : values) out.append(v == null ? "-1:" : v.length() + ":" + v); return out.toString();
    }
    private static String hash(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
