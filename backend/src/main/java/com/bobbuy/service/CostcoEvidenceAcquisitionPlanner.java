package com.bobbuy.service;

import java.net.URI;
import java.util.List;

/** Internal real-engine discovery plan. A proposed URL is not fetched or official evidence. */
public interface CostcoEvidenceAcquisitionPlanner {
    URI REQUIRED_NODE = URI.create("https://ccnode.briconbric.com:49530/v1");
    enum Kind { DOCUMENT, IMAGE }
    enum Priority { COSTCO, MANUFACTURER }
    record Source(URI canonicalUrl, URI fetchUrl, Kind kind, Priority priority) {
        public Source {
            CostcoOfficialEvidence.validateHttps(canonicalUrl); CostcoOfficialEvidence.validateHttps(fetchUrl);
            if (kind == null || priority == null) throw new IllegalArgumentException("onboarding.source_kind");
        }
    }
    record Plan(String inputHash, String provider, String model, URI endpoint, List<Source> sources, boolean discoveryComplete) {
        public Plan(String inputHash,String provider,String model,URI endpoint,List<Source> sources) {
            this(inputHash,provider,model,endpoint,sources,true);
        }
        public Plan {
            sources = List.copyOf(sources);
            if (inputHash == null || !inputHash.matches("[0-9a-f]{64}") || provider == null || provider.isBlank()
                    || model == null || model.isBlank() || endpoint == null || (sources.isEmpty() && !discoveryComplete) || sources.size() > 12)
                throw new IllegalArgumentException("onboarding.discovery_provenance");
        }
    }
    Plan plan(CostcoOfficialEvidenceFetcher.Query query);
    /** Next bounded discovery step, based on bytes already fetched and retained by merchant/hash.
     * Implementations may extract details/image URLs from real search/page evidence with the same AI gateway.
     */
    default Plan plan(CostcoOfficialEvidenceFetcher.Query query,List<CostcoOfficialEvidence> alreadyFetched) { return plan(query); }
}
