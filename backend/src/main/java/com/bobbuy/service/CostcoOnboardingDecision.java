package com.bobbuy.service;

import com.bobbuy.model.StorageCondition;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.math.BigDecimal;
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
            Map<String, String> translatedNames, List<String> unknownFields, List<ReferencePrice> referencePrices,Target target,PhotoFacts photoFacts,
            @JsonInclude(JsonInclude.Include.NON_NULL) ArchiveDetails archiveDetails) {
        public Candidate(String itemNumber,String brand,String name,String model,String specification,String packaging,String officialImageSha256,Map<String,String> translatedNames,List<String> unknownFields,List<ReferencePrice> referencePrices,Target target,PhotoFacts photoFacts){this(itemNumber,brand,name,model,specification,packaging,officialImageSha256,translatedNames,unknownFields,referencePrices,target,photoFacts,null);}
        public Candidate(String itemNumber,String brand,String name,String model,String specification,String packaging,String officialImageSha256,Map<String,String> translatedNames,List<String> unknownFields,List<ReferencePrice> referencePrices,Target target){this(itemNumber,brand,name,model,specification,packaging,officialImageSha256,translatedNames,unknownFields,referencePrices,target,null);}
        public Candidate {
            translatedNames = Map.copyOf(translatedNames); unknownFields = List.copyOf(unknownFields);referencePrices=referencePrices==null?List.of():List.copyOf(referencePrices);
        }
        public Candidate(String itemNumber,String brand,String name,String model,String specification,String packaging,String officialImageSha256,Map<String,String> translatedNames,List<String> unknownFields){this(itemNumber,brand,name,model,specification,packaging,officialImageSha256,translatedNames,unknownFields,List.of(),null);}
        public Candidate(String itemNumber,String brand,String name,String model,String specification,String packaging,String officialImageSha256,Map<String,String> translatedNames,List<String> unknownFields,List<ReferencePrice> referencePrices){this(itemNumber,brand,name,model,specification,packaging,officialImageSha256,translatedNames,unknownFields,referencePrices,null);}
    }
    public record ArchiveDetails(String descriptionJa,String categoryNodeId,StorageCondition storageCondition,
            @JsonInclude(JsonInclude.Include.NON_NULL) DescriptionEvidence descriptionEvidence) {
        public ArchiveDetails(String descriptionJa,String categoryNodeId,StorageCondition storageCondition) {
            this(descriptionJa,categoryNodeId,storageCondition,null);
        }
    }

    public record DescriptionEvidence(Map<String,String> translations,List<String> sourceSha256) {
        public DescriptionEvidence {
            translations=Map.copyOf(translations);
            sourceSha256=List.copyOf(sourceSha256);
            if(!translations.keySet().equals(java.util.Set.of("ja-JP","zh-CN","zh-TW","en-US"))
                    ||translations.values().stream().anyMatch(v->blank(v)||v.length()>2000)
                    ||sourceSha256.isEmpty()||sourceSha256.size()>8||sourceSha256.stream().distinct().count()!=sourceSha256.size()
                    ||sourceSha256.stream().anyMatch(s->!s.matches("[0-9a-f]{64}")))
                throw new IllegalArgumentException("onboarding.description_evidence");
        }
    }
    /** Suggestions from original private pixels, never an approved selling price or stock count. */
    public record PhotoFacts(BigDecimal amount,String currency,String unit,String conditions,String priceKind,boolean productVisible,
            @JsonInclude(JsonInclude.Include.NON_NULL) PhotoTranscription transcription,
            @JsonInclude(JsonInclude.Include.NON_NULL) Boolean priceTagVisible) {
        public PhotoFacts(BigDecimal amount,String currency,String unit,String conditions,String priceKind,boolean productVisible) {
            this(amount,currency,unit,conditions,priceKind,productVisible,null,null);
        }
        public PhotoFacts(BigDecimal amount,String currency,String unit,String conditions,String priceKind,boolean productVisible,
                PhotoTranscription transcription) {
            this(amount,currency,unit,conditions,priceKind,productVisible,transcription,null);
        }
        public PhotoFacts {
            if(transcription!=null&&transcription.incompleteTagText()){
                amount=null;currency=null;unit=null;conditions=null;priceKind="UNKNOWN";
            }
            if(Boolean.FALSE.equals(priceTagVisible)){
                amount=null;currency=null;unit=null;conditions=null;priceKind="UNKNOWN";
                if(transcription!=null&&!transcription.tags().isEmpty()){
                    var labels=new java.util.ArrayList<>(transcription.packagingLabels());
                    labels.addAll(transcription.tags());
                    transcription=new PhotoTranscription(List.of(),transcription.productFeatures(),transcription.uncertainties(),labels,transcription.incompleteTagText());
                }
            }
        }
    }

    /** Original text and structure from the private photo, bound to its hash by the INTAKE trace. */
    public record PhotoTranscription(List<PhotoTag> tags,List<String> productFeatures,List<String> uncertainties,
            @JsonInclude(JsonInclude.Include.NON_EMPTY) List<PhotoTag> packagingLabels,
            @JsonInclude(JsonInclude.Include.NON_DEFAULT) boolean incompleteTagText) {
        public PhotoTranscription(List<PhotoTag> tags,List<String> productFeatures,List<String> uncertainties){
            this(tags,productFeatures,uncertainties,List.of(),false);
        }
        public PhotoTranscription {
            tags=tags==null?List.of():List.copyOf(tags);
            productFeatures=photoTextList(productFeatures);
            uncertainties=photoTextList(uncertainties);
            packagingLabels=packagingLabels==null?List.of():List.copyOf(packagingLabels);
            if(tags.size()+packagingLabels.size()>12)throw new IllegalArgumentException("onboarding.photo_transcription");
        }
    }

    public record PhotoTag(String rawText,String itemNumber,String name,String brand,String unit,String specification,
            String netContent,String packageQuantity,String taxStatus,String conditions,String period,List<PhotoTagPrice> prices) {
        public PhotoTag {
            if(blank(rawText)||rawText.length()>6000)throw new IllegalArgumentException("onboarding.photo_transcription");
            for(String field:new String[]{itemNumber,name,brand,unit,specification,netContent,packageQuantity,taxStatus,conditions,period})
                if(field!=null&&field.length()>1000)throw new IllegalArgumentException("onboarding.photo_transcription");
            prices=prices==null?List.of():List.copyOf(prices);
            if(prices.size()>12)throw new IllegalArgumentException("onboarding.photo_transcription");
        }
    }

    public record PhotoTagPrice(PhotoTagPriceKind kind,String rawText,BigDecimal amount,String currency) {
        public PhotoTagPrice {
            if(kind==null||blank(rawText)||rawText.length()>250
                    ||(amount!=null&&(amount.signum()<0||amount.precision()>18||amount.scale()>6||amount.scale()<-8))
                    ||(currency!=null&&!currency.matches("[A-Z]{3}")))
                throw new IllegalArgumentException("onboarding.photo_transcription");
        }
    }
    public enum PhotoTagPriceKind { TOTAL, UNIT, STRIKETHROUGH, DISCOUNT, COUPON, UNKNOWN }

    private static List<String> photoTextList(List<String> input) {
        var result=input==null?List.<String>of():List.copyOf(input);
        if(result.size()>20||result.stream().anyMatch(v->blank(v)||v.length()>1000))
            throw new IllegalArgumentException("onboarding.photo_transcription");
        return result;
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
