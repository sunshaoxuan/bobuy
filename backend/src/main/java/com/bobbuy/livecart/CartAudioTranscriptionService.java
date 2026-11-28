package com.bobbuy.livecart;

import com.bobbuy.api.response.ApiException;
import com.bobbuy.api.response.ErrorCode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@Service
public class CartAudioTranscriptionService {
    public record Capability(boolean enabled, List<String> mimeTypes, int maxDurationSeconds, long maxBytes,
                             String providerStatus) {}
    public record Result(String text) {}
    private record Window(Instant startedAt, int count) {}

    private final AudioTranscriptionProvider provider;
    private final boolean approved;
    private final boolean verified;
    private final int maxDurationSeconds;
    private final long maxBytes;
    private final int rateLimit;
    private final Duration rateWindow;
    private final Semaphore concurrency;
    private final Clock clock;
    private final Duration providerTimeout;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    public CartAudioTranscriptionService(List<AudioTranscriptionProvider> providers,
            @Value("${bobbuy.cart-audio.provider:}") String providerId,
            @Value("${bobbuy.cart-audio.approved:false}") boolean approved,
            @Value("${bobbuy.cart-audio.verified:false}") boolean verified,
            @Value("${bobbuy.cart-audio.max-duration-seconds:60}") int maxDurationSeconds,
            @Value("${bobbuy.cart-audio.max-bytes:5242880}") long maxBytes,
            @Value("${bobbuy.cart-audio.max-concurrency:2}") int maxConcurrency,
            @Value("${bobbuy.cart-audio.rate-limit:6}") int rateLimit,
            @Value("${bobbuy.cart-audio.rate-window-seconds:60}") int rateWindowSeconds,
            @Value("${bobbuy.cart-audio.provider-timeout-seconds:30}") int providerTimeoutSeconds) {
        this(providers, providerId, approved, verified, maxDurationSeconds, maxBytes, maxConcurrency, rateLimit,
                Duration.ofSeconds(rateWindowSeconds), Clock.systemUTC(), Duration.ofSeconds(providerTimeoutSeconds));
    }

    CartAudioTranscriptionService(List<AudioTranscriptionProvider> providers, String providerId, boolean approved, boolean verified,
            int maxDurationSeconds, long maxBytes, int maxConcurrency, int rateLimit, Duration rateWindow, Clock clock) {
        this(providers, providerId, approved, verified, maxDurationSeconds, maxBytes, maxConcurrency, rateLimit, rateWindow, clock, Duration.ofSeconds(30));
    }
    CartAudioTranscriptionService(List<AudioTranscriptionProvider> providers, String providerId, boolean approved, boolean verified,
            int maxDurationSeconds, long maxBytes, int maxConcurrency, int rateLimit, Duration rateWindow, Clock clock, Duration providerTimeout) {
        this.provider = providers.stream().filter(p -> p.id().equals(providerId)).findFirst().orElse(null);
        this.approved = approved;
        this.verified = verified;
        this.maxDurationSeconds = Math.min(60, Math.max(1, maxDurationSeconds));
        this.maxBytes = Math.max(1, maxBytes);
        this.rateLimit = Math.max(1, rateLimit);
        this.rateWindow = rateWindow;
        this.concurrency = new Semaphore(Math.max(1, maxConcurrency));
        this.clock = clock;
        this.providerTimeout = providerTimeout.isNegative() || providerTimeout.isZero() ? Duration.ofSeconds(1) : providerTimeout;
    }

    public Capability capability() {
        boolean enabled = approved && verified && provider != null && !provider.supportedMimeTypes().isEmpty();
        return new Capability(enabled, enabled ? provider.supportedMimeTypes().stream().sorted().toList() : List.of(),
                maxDurationSeconds, maxBytes, enabled ? "verified-and-approved" : "unavailable");
    }

    public Result transcribe(String owner, MultipartFile file, double durationSeconds, String locale) {
        if (!capability().enabled()) throw error(ErrorCode.SERVICE_UNAVAILABLE, "audio.unavailable");
        if (file == null || file.isEmpty() || file.getSize() > maxBytes || durationSeconds <= 0 || durationSeconds > maxDurationSeconds)
            throw error(ErrorCode.INVALID_REQUEST, "audio.invalid");
        String declaredMime = normalize(file.getContentType());
        enforceRate(owner);
        if (!concurrency.tryAcquire()) throw error(ErrorCode.RATE_LIMITED, "audio.busy");
        try {
            byte[] bytes = file.getBytes();
            AudioContentInspector.Media media = AudioContentInspector.inspect(bytes)
                    .orElseThrow(() -> error(ErrorCode.INVALID_REQUEST, "audio.format"));
            if (!media.mimeType().equals(declaredMime) || !provider.supportedMimeTypes().contains(media.mimeType()))
                throw error(ErrorCode.INVALID_REQUEST, "audio.format");
            if (media.durationSeconds() > maxDurationSeconds || Math.abs(media.durationSeconds() - durationSeconds) > Math.max(2, media.durationSeconds() * .1))
                throw error(ErrorCode.INVALID_REQUEST, "audio.invalid");
            String text = transcribeBounded(bytes, media.mimeType(), locale == null ? "" : locale);
            if (text == null || text.isBlank()) throw error(ErrorCode.SERVICE_UNAVAILABLE, "audio.empty");
            return new Result(text.strip());
        } catch (ApiException ex) {
            throw ex;
        } catch (Exception ex) {
            throw error(ErrorCode.SERVICE_UNAVAILABLE, "audio.failed");
        } finally {
            concurrency.release();
        }
    }

    private String transcribeBounded(byte[] bytes, String mime, String locale) throws Exception {
        ExecutorService executor = Executors.newSingleThreadExecutor(r -> { Thread t=new Thread(r,"cart-audio-provider");t.setDaemon(true);return t; });
        Future<String> call = executor.submit(() -> provider.transcribe(bytes, mime, locale));
        try {
            return call.get(providerTimeout.toMillis(), TimeUnit.MILLISECONDS);
        } catch (InterruptedException ex) {
            call.cancel(true); Thread.currentThread().interrupt(); throw ex;
        } catch (TimeoutException ex) {
            call.cancel(true); throw ex;
        } catch (ExecutionException ex) {
            if (ex.getCause() instanceof Exception cause) throw cause;
            throw ex;
        } finally {
            executor.shutdownNow();
        }
    }

    private void enforceRate(String owner) {
        Instant now = clock.instant();
        Window next = windows.compute(owner, (key, old) -> old == null || Duration.between(old.startedAt(), now).compareTo(rateWindow) >= 0
                ? new Window(now, 1) : new Window(old.startedAt(), old.count() + 1));
        if (next.count() > rateLimit) throw error(ErrorCode.RATE_LIMITED, "audio.rate_limited");
    }

    private static String normalize(String value) {
        return value == null ? "" : value.split(";", 2)[0].trim().toLowerCase(Locale.ROOT);
    }
    private static ApiException error(ErrorCode code, String key) { return new ApiException(code, key); }
}
