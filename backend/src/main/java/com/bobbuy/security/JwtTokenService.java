package com.bobbuy.security;

import com.bobbuy.model.User;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JwtTokenService {
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {
    };
    private static final Base64.Encoder URL_ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder URL_DECODER = Base64.getUrlDecoder();
    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final String JWT_ALGORITHM = "HS256";
    private static final long MIN_TTL_SECONDS = 60L;

    private final ObjectMapper objectMapper;
    private final String secret;
    private final Duration ttl;

    public JwtTokenService(ObjectMapper objectMapper,
                           @Value("${bobbuy.security.jwt.secret:}") String secret,
                           @Value("${bobbuy.security.jwt.ttl-seconds:3600}") long ttlSeconds) {
        this.objectMapper = objectMapper;
        this.secret = secret == null ? "" : secret.trim();
        this.ttl = Duration.ofSeconds(Math.max(ttlSeconds, MIN_TTL_SECONDS));
    }

    @PostConstruct
    void validateConfiguration() {
        if (secret.isBlank()) {
            throw new IllegalStateException("Missing bobbuy.security.jwt.secret / BOBBUY_SECURITY_JWT_SECRET configuration.");
        }
    }

    public String createAccessToken(User user) {
        return createAccessTokenDetails(user).token();
    }

    public IssuedAccessToken createAccessTokenDetails(User user) {
        Instant now = Instant.now();
        Map<String, Object> header = Map.of("alg", JWT_ALGORITHM, "typ", "JWT");
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("sub", String.valueOf(user.getId()));
        payload.put("roles", user.getRoles());
        payload.put("username", user.getUsername());
        payload.put("name", user.getName());
        payload.put("jti", UUID.randomUUID().toString());
        payload.put("iat", now.getEpochSecond());
        payload.put("exp", now.plus(ttl).getEpochSecond());
        String encodedHeader = encodeJson(header);
        String encodedPayload = encodeJson(payload);
        String signature = sign(encodedHeader + "." + encodedPayload);
        return new IssuedAccessToken(encodedHeader + "." + encodedPayload + "." + signature, now.plus(ttl));
    }

    public VerifiedToken verify(String token) {
        if (token == null || token.isBlank()) {
            throw new IllegalArgumentException("Token is blank");
        }
        String[] parts = token.split("\\.");
        if (parts.length != 3) {
            throw new IllegalArgumentException("Malformed token");
        }
        String signingInput = parts[0] + "." + parts[1];
        String expectedSignature = sign(signingInput);
        if (!MessageDigest.isEqual(expectedSignature.getBytes(StandardCharsets.UTF_8), parts[2].getBytes(StandardCharsets.UTF_8))) {
            throw new IllegalArgumentException("Invalid token signature");
        }
        Map<String, Object> payload = decodeJson(parts[1]);
        long expiresAt = readLong(payload.get("exp"));
        if (Instant.now().getEpochSecond() >= expiresAt) {
            throw new IllegalArgumentException("Token expired");
        }
        return new VerifiedToken(readLong(payload.get("sub")), readString(payload.get("username")));
    }

    private String encodeJson(Map<String, Object> value) {
        try {
            return URL_ENCODER.encodeToString(objectMapper.writeValueAsBytes(value));
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to encode JWT JSON", ex);
        }
    }

    private Map<String, Object> decodeJson(String encoded) {
        try {
            return objectMapper.readValue(URL_DECODER.decode(encoded), MAP_TYPE);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Failed to decode JWT payload", ex);
        }
    }

    private String sign(String content) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM));
            return URL_ENCODER.encodeToString(mac.doFinal(content.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException | InvalidKeyException ex) {
            throw new IllegalStateException("Failed to sign JWT", ex);
        }
    }

    private long readLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value instanceof String stringValue && !stringValue.isBlank()) {
            return Long.parseLong(stringValue);
        }
        throw new IllegalArgumentException("Missing numeric JWT claim");
    }

    private String readString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    public record VerifiedToken(Long userId, String username) {
    }

    public record IssuedAccessToken(String token, Instant expiresAt) {
    }
}
