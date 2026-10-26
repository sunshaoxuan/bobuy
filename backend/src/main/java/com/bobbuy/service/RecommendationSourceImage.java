package com.bobbuy.service;

import com.bobbuy.api.response.*;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import org.springframework.stereotype.Service;

/** The visible editor's URL import supports only the official Costco Japan mail image host. */
@Service
public class RecommendationSourceImage {
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10))
        .followRedirects(HttpClient.Redirect.NEVER).build();
    public RecommendationImageValidator.Image fetch(String source) {
        try {
            URI uri = URI.create(source);
            if (!"https".equals(uri.getScheme()) || !"cds2.costcojapan.jp".equals(uri.getHost())
                    || uri.getPort() != -1 || uri.getUserInfo() != null || uri.getFragment() != null
                    || !uri.getPath().startsWith("/cds/mail-images/")) throw invalid();
            var request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(20)).GET().build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofInputStream());
            try (var input = response.body()) {
                if (response.statusCode() != 200) throw invalid();
                return RecommendationImageValidator.validate(input.readNBytes(RecommendationImageValidator.MAX_BYTES + 1));
            }
        } catch (InterruptedException ex) { Thread.currentThread().interrupt(); throw invalid(); }
        catch (Exception ex) { throw invalid(); }
    }
    private static ApiException invalid() { return new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.source_image"); }
}
