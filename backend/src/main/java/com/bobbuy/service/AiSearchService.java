package com.bobbuy.service;

import com.bobbuy.util.EncryptionUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;

/**
 * Service for executing AI-driven web research using secure API keys.
 */
@Service
public class AiSearchService {
    private static final Logger log = LoggerFactory.getLogger(AiSearchService.class);

    @Value("${bobbuy.ai.secret.brave.salt:}")
    private String braveSalt;
    @Value("${bobbuy.ai.secret.brave.nonce:}")
    private String braveNonce;
    @Value("${bobbuy.ai.secret.brave.ciphertext:}")
    private String braveCiphertext;
    @Value("${bobbuy.ai.secret.brave.tag:}")
    private String braveTag;
    @Value("${bobbuy.ai.secret.brave.iterations:200000}")
    private int braveIterations;
    @Value("${bobbuy.ai.search.brave.enabled:false}")
    private boolean braveEnabled;

    // The master password should be provided via environment variable for security
    @Value("${AI_ENCRYPTION_PWD:}")
    private String masterPassword;

    private String decryptedBraveKey;
    private String initializationStatus="NOT_INITIALIZED";
    public String initializationStatus(){return initializationStatus;}

    @PostConstruct
    public void init() {
        if (!braveEnabled) {
            initializationStatus="DISABLED";
            log.info("Brave Search is disabled by configuration.");
            return;
        }
        if (braveSalt == null || braveSalt.isBlank() || braveCiphertext == null || braveCiphertext.isBlank()) {
            initializationStatus="CONFIGURATION_ABSENT";
            log.warn("Brave Search API key configuration is not present. Web research will be disabled.");
            return;
        }
        try {
            log.info("Initializing AiSearchService: Decrypting Brave Search API Key...");
            this.decryptedBraveKey = EncryptionUtils.decrypt(
                masterPassword, braveSalt, braveNonce, braveCiphertext, braveTag, braveIterations
            );
            initializationStatus="READY";
            log.info("Brave Search API Key successfully decrypted.");
        } catch (Exception e) {
            initializationStatus="DECRYPTION_FAILED_"+e.getClass().getSimpleName();
            log.error("Search credential initialization failed ({}). Web research is disabled.",e.getClass().getSimpleName());
        }
    }

    public String search(String query) {
        if (decryptedBraveKey == null) {
            log.warn("Search attempted but Brave API key is missing or failed to decrypt.");
            return "";
        }
        // Implementation for Brave Search API call would go here
        log.info("Executing Brave Search request.");
        return "Stub results for: " + query;
    }

    /** Real search only; no stub text and no inferred product/image URLs. */
    public boolean officialSearchConfigured(){return braveEnabled&&decryptedBraveKey!=null&&!decryptedBraveKey.isBlank();}
    public java.util.List<String> officialProductUrls(String item) {
        if (decryptedBraveKey == null || decryptedBraveKey.isBlank()) return java.util.List.of();
        try {
            var uri=org.springframework.web.util.UriComponentsBuilder.fromHttpUrl("https://api.search.brave.com/res/v1/web/search")
                .queryParam("q","site:www.costco.co.jp \""+item+"\"").queryParam("count",5).build().encode().toUri();
            var factory=new org.springframework.http.client.SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(java.time.Duration.ofSeconds(10));factory.setReadTimeout(java.time.Duration.ofSeconds(20));
            String body=org.springframework.web.client.RestClient.builder().requestFactory(factory).build().get().uri(uri)
                .header("X-Subscription-Token",decryptedBraveKey).retrieve().body(String.class);
            var results=new com.fasterxml.jackson.databind.ObjectMapper().readTree(body).path("web").path("results");
            var urls=new java.util.ArrayList<String>();
            for(var row:results){String url=row.path("url").asText("");try{OfficialProductResearch.pageUri(url);urls.add(url);}catch(com.bobbuy.api.response.ApiException ignored){}}
            return java.util.List.copyOf(urls);
        } catch (Exception error) {
            if(error instanceof org.springframework.web.client.RestClientResponseException response)throw new OfficialProductResearch.AccessFailure(response.getStatusCode().value(),"https://api.search.brave.com/res/v1/web/search","error.ai.web_search_failed");
            // Never log authentication headers, provider body, or inferred substitute results.
            throw new com.bobbuy.api.response.ApiException(com.bobbuy.api.response.ErrorCode.INVALID_REQUEST,"error.ai.web_search_failed");
        }
    }
}
