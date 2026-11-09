package com.bobbuy.service;

import java.net.URI;
import java.util.List;
import java.util.Map;

/** Structured output of a real semantic engine, not a client-supplied approval flag. */
public record CostcoOnboardingDecision(Stage stage, Verdict verdict, String provider, String model,
        URI endpoint, String inputHash, List<String> evidenceHashes, String policyVersion,
        String promptVersion, String reason, String identifiedItemNumber, Candidate candidate, EngineTrace trace) {
    public enum Stage { INTAKE, IDENTITY, FACTS, IMAGE_SOURCE, ADMISSION }
    public enum Verdict { ACCEPT, NEEDS_EVIDENCE, AMBIGUOUS, REJECT }
    public record EngineTrace(String inputRef,String outputRef,long latencyMs,Long promptTokens,Long completionTokens,Map<String,String> imageViewHashes) {
        public EngineTrace {
            if(inputRef==null||!inputRef.matches("[0-9a-f]{64}")||outputRef==null||!outputRef.matches("[0-9a-f]{64}")||latencyMs<0
                    ||(promptTokens!=null&&promptTokens<0)||(completionTokens!=null&&completionTokens<0))throw new IllegalArgumentException("onboarding.engine_trace");
            imageViewHashes=Map.copyOf(imageViewHashes);
            if(imageViewHashes.entrySet().stream().anyMatch(e->!e.getKey().matches("[0-9a-f]{64}")||!e.getValue().matches("[0-9a-f]{64}")))throw new IllegalArgumentException("onboarding.engine_image_trace");
        }
    }
    public CostcoOnboardingDecision(Stage stage,Verdict verdict,String provider,String model,URI endpoint,String inputHash,List<String> evidenceHashes,
            String policyVersion,String promptVersion,String reason,String identifiedItemNumber,Candidate candidate) {
        this(stage,verdict,provider,model,endpoint,inputHash,evidenceHashes,policyVersion,promptVersion,reason,identifiedItemNumber,candidate,null);
    }
    public CostcoOnboardingDecision {
        if (stage == null || verdict == null || blank(provider) || blank(model) || endpoint == null
                || inputHash == null || !inputHash.matches("[0-9a-f]{64}") || blank(policyVersion)
                || blank(promptVersion) || blank(reason)) throw new IllegalArgumentException("onboarding.decision_provenance");
        evidenceHashes = List.copyOf(evidenceHashes);
        if (evidenceHashes.stream().anyMatch(h -> h == null || !h.matches("[0-9a-f]{64}")))
            throw new IllegalArgumentException("onboarding.decision_evidence");
    }
    /** Unknown facts remain unknown. Price/stock/publication are intentionally absent. */
    public record Candidate(String itemNumber, String brand, String name, String model,
            String specification, String packaging, String officialImageSha256,
            Map<String, String> translatedNames, List<String> unknownFields, List<ReferencePrice> referencePrices,Target target) {
        public Candidate {
            translatedNames = Map.copyOf(translatedNames); unknownFields = List.copyOf(unknownFields);referencePrices=referencePrices==null?List.of():List.copyOf(referencePrices);
        }
        public Candidate(String itemNumber,String brand,String name,String model,String specification,String packaging,String officialImageSha256,Map<String,String> translatedNames,List<String> unknownFields){this(itemNumber,brand,name,model,specification,packaging,officialImageSha256,translatedNames,unknownFields,List.of(),null);}
        public Candidate(String itemNumber,String brand,String name,String model,String specification,String packaging,String officialImageSha256,Map<String,String> translatedNames,List<String> unknownFields,List<ReferencePrice> referencePrices){this(itemNumber,brand,name,model,specification,packaging,officialImageSha256,translatedNames,unknownFields,referencePrices,null);}
    }
    public record Target(String productId,long version,String sourceHash) {
        public Target {
            if(productId==null||productId.isBlank()||productId.length()>255||version<0||sourceHash==null||!sourceHash.matches("[0-9a-f]{64}"))throw new IllegalArgumentException("onboarding.target_contract");
        }
    }
    public record ReferencePrice(String kind,java.math.BigDecimal amount,String currency,String channel,String taxStatus,
            String quantityBasis,String validFrom,String validUntil,String timeZone,String conditions,URI sourceUrl,String sourceSha256) {
        public ReferencePrice {
            if(kind==null||!java.util.Set.of("REGULAR","OFFER","DISCOUNT","COUPON").contains(kind)||amount==null||amount.signum()<0
                    ||currency==null||!currency.matches("[A-Z]{3}")||sourceSha256==null||!sourceSha256.matches("[0-9a-f]{64}"))throw new IllegalArgumentException("onboarding.reference_quote");
            CostcoOfficialEvidence.validateHttps(sourceUrl);
            if(validFrom!=null)java.time.LocalDate.parse(validFrom);if(validUntil!=null)java.time.LocalDate.parse(validUntil);
            if(validFrom!=null&&validUntil!=null&&java.time.LocalDate.parse(validUntil).isBefore(java.time.LocalDate.parse(validFrom)))throw new IllegalArgumentException("onboarding.reference_window");
            if(timeZone!=null)java.time.ZoneId.of(timeZone);
        }
    }
    private static boolean blank(String v) { return v == null || v.isBlank(); }
}
