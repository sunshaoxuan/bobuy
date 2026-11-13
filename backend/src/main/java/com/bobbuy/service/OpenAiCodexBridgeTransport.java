package com.bobbuy.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class OpenAiCodexBridgeTransport implements CodexBridgeTransport {
    private final BridgeRoutingProperties properties;
    private final ObjectMapper mapper;
    private final ObjectProvider<LlmGateway> gateway;
    public OpenAiCodexBridgeTransport(BridgeRoutingProperties properties, ObjectMapper mapper, ObjectProvider<LlmGateway> gateway) {
        this.properties = properties; this.mapper = mapper; this.gateway = gateway;
    }
    @Override public Reply complete(String model, String prompt, List<String> images, Duration timeout) {
        if (!secure(properties.getUrl())) throw new Failure(false);
        String apiKey = properties.getApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            apiKey = gateway.getObject().resolveCodexBridgeApiKey().orElseThrow(() -> new Failure(false));
        }
        var payload = new LinkedHashMap<String, Object>(); payload.put("model", model); payload.put("stream", false);
        Object content = prompt;
        if (images != null && !images.isEmpty()) {
            var parts = new ArrayList<Map<String, Object>>(); parts.add(Map.of("type", "text", "text", prompt));
            for (String image : images) parts.add(Map.of("type", "image_url", "image_url", Map.of("url", imageUrl(image))));
            content = parts;
        }
        payload.put("messages", List.of(Map.of("role", "user", "content", content)));
        try {
            var factory = new SimpleClientHttpRequestFactory(); factory.setConnectTimeout(timeout); factory.setReadTimeout(timeout);
            String body = RestClient.builder().requestFactory(factory).build().post()
                    .uri(URI.create(trim(properties.getUrl()) + "/chat/completions"))
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey).contentType(MediaType.APPLICATION_JSON)
                    .body(payload).retrieve().body(String.class);
            var json = mapper.readTree(body); String actual = json.path("model").asText(model);
            String answer = json.path("choices").path(0).path("message").path("content").asText();
            if (answer.isBlank()) throw new Failure(false);
            return new Reply(answer, actual);
        } catch (RestClientResponseException error) {
            throw new Failure(error.getStatusCode().value() == 429 || error.getStatusCode().value() == 402);
        } catch (Failure error) { throw error; }
        catch (Exception error) { throw new Failure(false); }
    }
    private static String imageUrl(String image) {
        if (image.regionMatches(true, 0, "data:", 0, 5)
                || image.regionMatches(true, 0, "http://", 0, 7)
                || image.regionMatches(true, 0, "https://", 0, 8)) return image;
        String type = image.startsWith("/9j/") ? "jpeg" : "png";
        // Decode only the RIFF/WEBP header, keeping large receipt images out of an extra buffer.
        if (image.startsWith("UklGR") && image.length() >= 16) {
            try {
                byte[] header = java.util.Base64.getDecoder().decode(image.substring(0, 16));
                if (header[8] == 'W' && header[9] == 'E' && header[10] == 'B' && header[11] == 'P') type = "webp";
            } catch (IllegalArgumentException ignored) { }
        }
        return "data:image/" + type + ";base64," + image;
    }
    private static boolean secure(String value) {
        try { var uri = URI.create(value); return uri.getHost() != null && uri.getUserInfo() == null && uri.getQuery() == null
                && ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()) && List.of("localhost", "127.0.0.1", "::1").contains(uri.getHost())); }
        catch (Exception ignored) { return false; }
    }
    private static String trim(String value) { return value.endsWith("/") ? value.substring(0, value.length() - 1) : value; }
}
