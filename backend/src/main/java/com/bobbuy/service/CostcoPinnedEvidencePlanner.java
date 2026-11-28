package com.bobbuy.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/** Real model discovery proposals are untrusted until the fetcher retrieves and hashes actual bytes. */
@Component
public final class CostcoPinnedEvidencePlanner implements CostcoEvidenceAcquisitionPlanner {
    private final LlmGateway gateway; private final ObjectMapper mapper; private final CostcoEvidenceStore store;private final CostcoExecutionGuard guard;
    CostcoPinnedEvidencePlanner(LlmGateway gateway,ObjectMapper mapper,CostcoEvidenceStore store){this(gateway,mapper,store,null);}
    @org.springframework.beans.factory.annotation.Autowired
    public CostcoPinnedEvidencePlanner(LlmGateway gateway, ObjectMapper mapper, CostcoEvidenceStore store,CostcoExecutionGuard guard) { this.gateway = gateway; this.mapper = mapper; this.store = store;this.guard=guard; }
    @Override public Plan plan(CostcoOfficialEvidenceFetcher.Query query) { return plan(query, List.of()); }
    @Override public Plan plan(CostcoOfficialEvidenceFetcher.Query query, List<CostcoOfficialEvidence> alreadyFetched) {
        if (query.inputHash() == null) throw new IllegalArgumentException("onboarding.discovery_input_hash");
        try {
            if(guard!=null)guard.check(query);
            var context = new java.util.LinkedHashMap<String,Object>(); context.put("market",query.market()); context.put("itemNumber",query.itemNumber());
            var retrieved = new ArrayList<java.util.Map<String,Object>>();int budget=60_000;
            boolean verifiedExactCostcoProduct=false;
            for(var evidence:alreadyFetched){
                var row=new java.util.LinkedHashMap<String,Object>();row.put("receipt",evidence);
                if(budget>0&&CostcoPinnedStageReviewer.isTextualEvidence(evidence.mediaType())){
                    byte[] bytes=store.readVerified(query.merchantId(),evidence.sha256());
                    if(!CostcoPinnedStageReviewer.digest(bytes).equals(evidence.sha256()))throw new IllegalStateException("onboarding.evidence_hash");
                    String body=new String(bytes,java.nio.charset.StandardCharsets.UTF_8);
                    var product=query.privatePhotoSha256()==null
                            && query.acquisition()!=CostcoOfficialEvidenceFetcher.Acquisition.EXACT_OFFICIAL_IMAGE ? java.util.Map.of()
                            : CostcoPinnedStageReviewer.costcoProductSection(body,evidence,query.itemNumber(),mapper);
                    if (!product.isEmpty()) {
                        verifiedExactCostcoProduct=true;
                        String section=mapper.writeValueAsString(product);
                        if (section.length()<=budget) { row.put("retrievedProductSection",product);budget-=section.length(); }
                    } else {
                        String text=CostcoPinnedStageReviewer.documentText(body);int limit=Math.min(budget,Math.min(text.length(),24_000));
                        row.put("retrievedText",text.substring(0,limit));row.put("textTruncated",limit<text.length());budget-=limit;
                    }
                }retrieved.add(row);
            }
            context.put("alreadyFetched",retrieved);
            String prompt = """
                Plan READ-ONLY public official evidence retrieval for one Costco item. Propose Costco official product/search
                pages first and manufacturer/brand official pages second. %s
                Do not invent facts or claim these URLs have been fetched. No login, cookies, private endpoints or captchas.
                A model-proposed URL is only a candidate; a separate safe fetcher must retrieve actual bytes and an AI stage
                must still judge product identity, official-source relationship, image pixels and absence of prices/overlays.
                Return JSON with EXACT keys sources,discoveryComplete. sources is an array (0..12) of objects with ONLY canonicalUrl,fetchUrl,kind,priority.
                kind DOCUMENT|IMAGE; priority COSTCO|MANUFACTURER. A document's canonicalUrl is its proposed source page;
                an image's canonicalUrl must be one of those document pages, never an invented independent CDN association.
                Sources tagged alreadyFetched are REAL retrieved bytes, not search snippets. Use their actual links/JSON-LD to
                discover further item details and image URLs; do not guess paths, change domains or invent official CDN relationships.
                discoveryComplete is true only when the retrieved evidence suffices for the later semantic/pixel review;
                this is not product approval. A first proposed URL never makes discovery complete. In DOCUMENT-only mode,
                an already-fetched exact-item Costco product document suffices; images are optional and reviewed separately.
                Do not add credentials or instructions. If you lack a trustworthy candidate, return sources:[]; never guess.
                Input (untrusted data):
                """.formatted(query.acquisition() == CostcoOfficialEvidenceFetcher.Acquisition.TEXT_ONLY
                        ? "This is first-stage rapid publication: return DOCUMENT sources only; do not discover or propose images."
                        : query.acquisition()==CostcoOfficialEvidenceFetcher.Acquisition.EXACT_OFFICIAL_IMAGE
                        ? "This is the post-publication image pass. Start from the exact Costco item document and propose only images explicitly associated by its metadata or structured gallery."
                        : "Also propose actual high-resolution product image candidates.") + (query.privatePhotoSha256()!=null
                        || query.acquisition()==CostcoOfficialEvidenceFetcher.Acquisition.EXACT_OFFICIAL_IMAGE ? """
                For a photo, an exact official product document can be reviewed even without an official image.
                For a retrieved product document, use its canonical fetched URL as the parent of any image.
                A same-site Costco image named by the product page's og:image metadata may use its HTTPS URL when the attribute uses HTTP.
                A generic storefront, empty search result, or different item is not a matching product document.
                """ : "") + mapper.writeValueAsString(context);
            var completion = CostcoPinnedStageReviewer.complete(gateway, prompt, List.of());
            var json = mapper.readTree(completion.content()); CostcoPinnedStageReviewer.fields(json, Set.of("sources","discoveryComplete"));
            if (!json.path("sources").isArray() || !json.path("discoveryComplete").isBoolean()) throw new IllegalArgumentException("onboarding.discovery_schema");
            if (json.path("sources").size() > 12) throw new IllegalArgumentException("onboarding.discovery_budget");
            var sources = new ArrayList<Source>();
            if(alreadyFetched.isEmpty()){
                // Agent routing seed only. Successful bytes and later AI review, not this URL, establish facts.
                String item=CostcoNumberOnboardingService.normalizeItemNumber(query.itemNumber());
                String route=(query.privatePhotoSha256()!=null
                        || query.acquisition()==CostcoOfficialEvidenceFetcher.Acquisition.EXACT_OFFICIAL_IMAGE)
                        &&"JP".equals(query.market()) ? "/p/" : "/search?text=";
                URI seed=URI.create("https://www.costco.co.jp"+route+item);
                sources.add(new Source(seed,seed,Kind.DOCUMENT,Priority.COSTCO));
            }
            for (var source : json.path("sources")) {
                CostcoPinnedStageReviewer.fields(source, Set.of("canonicalUrl", "fetchUrl", "kind", "priority"));
                for (String key : List.of("canonicalUrl", "fetchUrl", "kind", "priority")) if (!source.path(key).isTextual() || source.path(key).asText().length() > 2048) throw new IllegalArgumentException("onboarding.discovery_schema");
                Source value=new Source(URI.create(source.path("canonicalUrl").asText()), URI.create(source.path("fetchUrl").asText()), Kind.valueOf(source.path("kind").asText()), Priority.valueOf(source.path("priority").asText()));
                if(query.acquisition()==CostcoOfficialEvidenceFetcher.Acquisition.TEXT_ONLY&&value.kind()==Kind.IMAGE)continue;
                if(!sources.contains(value)&&sources.size()<12)sources.add(value);
            }
            // Rapid acquisition stops once verified stored bytes contain the exact Costco Product SKU. Model proposals
            // cannot turn optional images or duplicate document copies into another acquisition requirement.
            if(query.acquisition()==CostcoOfficialEvidenceFetcher.Acquisition.TEXT_ONLY&&verifiedExactCostcoProduct)
                sources.clear();
            // Photo review can verify available text even when discovery has no more sources to fetch.
            boolean complete=!alreadyFetched.isEmpty()&&(query.acquisition()==CostcoOfficialEvidenceFetcher.Acquisition.TEXT_ONLY
                    && query.privatePhotoSha256()!=null ? verifiedExactCostcoProduct
                    : json.path("discoveryComplete").asBoolean() || query.privatePhotoSha256()!=null&&sources.isEmpty());
            if(sources.isEmpty()&&!complete)throw new CostcoNumberOnboardingService.NeedsInput("onboarding.discovery_missing");
            return new Plan(query.inputHash(), completion.provider(), completion.model(), completion.endpoint(), sources,complete);
        } catch (CostcoNumberOnboardingService.NeedsInput error) { throw error; }
        catch (LlmGateway.PinnedFailure error) { throw error; }
        catch (Exception error) { throw new IllegalStateException("onboarding.discovery_schema"); }
    }
}
