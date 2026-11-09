package com.bobbuy.service;

import java.net.URI;
import java.time.Instant;
import java.util.List;

/** Server retrieval receipt. Official identity and image suitability are separate AI decisions. */
public record CostcoOfficialEvidence(String id, URI canonicalUrl, URI fetchedUrl, String sha256,
        Instant fetchedAt, String mediaType, Integer width, Integer height, List<URI> redirectChain,
        String sourceDocumentSha256) {
    public CostcoOfficialEvidence(String id, URI canonicalUrl, URI fetchedUrl, String sha256,
            Instant fetchedAt, String mediaType, Integer width, Integer height, List<URI> redirectChain) {
        this(id, canonicalUrl, fetchedUrl, sha256, fetchedAt, mediaType, width, height, redirectChain, null);
    }
    public CostcoOfficialEvidence {
        if (id == null || id.isBlank() || sha256 == null || !sha256.matches("[0-9a-f]{64}") || fetchedAt == null)
            throw new IllegalArgumentException("onboarding.evidence_receipt");
        validateHttps(canonicalUrl); validateHttps(fetchedUrl);
        redirectChain = List.copyOf(redirectChain);
        redirectChain.forEach(CostcoOfficialEvidence::validateHttps);
        if (sourceDocumentSha256 != null && !sourceDocumentSha256.matches("[0-9a-f]{64}"))
            throw new IllegalArgumentException("onboarding.evidence_source_hash");
        if (mediaType == null || mediaType.isBlank() || (width != null && width <= 0) || (height != null && height <= 0))
            throw new IllegalArgumentException("onboarding.evidence_media");
    }
    public static void validateHttps(URI uri) {
        if (uri == null || !"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null
                || uri.getRawUserInfo() != null || uri.getFragment() != null || (uri.getPort() != -1 && uri.getPort() != 443))
            throw new IllegalArgumentException("onboarding.https_required");
        // DNS and each redirect must additionally be validated by the retrieval adapter before I/O.
    }
}
