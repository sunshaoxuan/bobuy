package com.bobbuy.model;

import com.bobbuy.service.CostcoOfficialEvidence;
import com.bobbuy.service.CostcoOnboardingDecision;
import java.time.Instant;
import java.util.List;

/** Immutable domain state, deliberately not a scanned JPA entity before a coordinated migration. */
public record CostcoOnboardingJob(String id, String idempotencyKey, long merchantId, String supplierId,
        String market, String inputHash, String itemNumber, String privatePhotoSha256,
        long revision, State state, List<CostcoOfficialEvidence> evidence,
        List<CostcoOnboardingDecision> decisions, String productId, Long productVersion,
        String failureCode, Instant updatedAt,
        @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
        String packagingPhotoSha256) {
    public CostcoOnboardingJob(String id,String idempotencyKey,long merchantId,String supplierId,String market,
            String inputHash,String itemNumber,String privatePhotoSha256,long revision,State state,
            List<CostcoOfficialEvidence> evidence,List<CostcoOnboardingDecision> decisions,String productId,
            Long productVersion,String failureCode,Instant updatedAt) {
        this(id,idempotencyKey,merchantId,supplierId,market,inputHash,itemNumber,privatePhotoSha256,revision,state,
                evidence,decisions,productId,productVersion,failureCode,updatedAt,null);
    }
    public enum State { QUEUED, AI_INTAKE, EVIDENCE_FETCH, AI_REVIEW, COMMITTING,
        COMPLETED, NEEDS_INPUT, RETRY_WAIT, FAILED, CANCELLED }
    public CostcoOnboardingJob {
        if (id == null || id.isBlank() || idempotencyKey == null || !idempotencyKey.matches("[0-9a-f]{64}")
                || inputHash == null || !inputHash.matches("[0-9a-f]{64}") || market == null || !market.matches("[A-Z]{2}")
                || merchantId <= 0 || supplierId == null || supplierId.isBlank() || supplierId.length() > 100 || revision < 0 || state == null || updatedAt == null)
            throw new IllegalArgumentException("onboarding.job");
        if(packagingPhotoSha256!=null&&(privatePhotoSha256==null||!packagingPhotoSha256.matches("[0-9a-f]{64}")))
            throw new IllegalArgumentException("onboarding.photo_receipt");
        evidence = List.copyOf(evidence); decisions = List.copyOf(decisions);
        if (state == State.COMPLETED && (productId == null || productId.isBlank() || productVersion == null || productVersion < 0))
            throw new IllegalArgumentException("onboarding.unverified_completion");
    }
}
