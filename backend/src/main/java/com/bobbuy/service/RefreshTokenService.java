package com.bobbuy.service;

import com.bobbuy.api.response.ApiException;
import com.bobbuy.api.response.ErrorCode;
import com.bobbuy.model.RefreshTokenSession;
import com.bobbuy.model.User;
import com.bobbuy.repository.RefreshTokenSessionRepository;
import com.bobbuy.repository.UserRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RefreshTokenService {
    private static final long MIN_TTL_SECONDS = 1L;
    private static final int TOKEN_BYTES = 48;
    private static final int MAX_CLIENT_FINGERPRINT_LENGTH = 255;
    private static final Base64.Encoder URL_ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final HexFormat HEX_FORMAT = HexFormat.of();
    private static final String REVOCATION_ROTATED = "ROTATED";
    private static final String REVOCATION_LOGOUT = "LOGOUT";
    private static final String REVOCATION_REUSE_DETECTED = "REUSE_DETECTED";
    private static final String REVOCATION_EXPIRED = "EXPIRED";
    private static final String REVOCATION_USER_DISABLED = "USER_DISABLED";
    private static final String REVOCATION_PASSWORD_RESET = "PASSWORD_RESET";

    private final RefreshTokenSessionRepository refreshTokenSessionRepository;
    private final UserRepository userRepository;
    private final Duration refreshTokenTtl;
    private final boolean rotationEnabled;
    private final SecureRandom secureRandom = new SecureRandom();

    public RefreshTokenService(
        RefreshTokenSessionRepository refreshTokenSessionRepository,
        UserRepository userRepository,
        @Value("${bobbuy.security.refresh-token.ttl-seconds:604800}") long ttlSeconds,
        @Value("${bobbuy.security.refresh-token.rotation-enabled:true}") boolean rotationEnabled
    ) {
        this.refreshTokenSessionRepository = refreshTokenSessionRepository;
        this.userRepository = userRepository;
        this.refreshTokenTtl = Duration.ofSeconds(Math.max(ttlSeconds, MIN_TTL_SECONDS));
        this.rotationEnabled = rotationEnabled;
    }

    @Transactional
    public IssuedRefreshToken issue(User user, String clientFingerprint) {
        // The user row is the common serialization point for session issuance,
        // rotation, and password reset.
        user = userRepository.lockById(user.getId()).filter(User::isEnabled)
            .orElseThrow(this::invalidRefreshToken);
        Instant now = Instant.now();
        String rawToken = generateOpaqueToken();
        RefreshTokenSession session = new RefreshTokenSession();
        session.setUserId(user.getId());
        session.setTokenHash(hashToken(rawToken));
        session.setFamilyId(generateFamilyId());
        session.setClientFingerprint(sanitizeClientFingerprint(clientFingerprint));
        session.setCreatedAt(now);
        session.setLastUsedAt(now);
        session.setExpiresAt(now.plus(refreshTokenTtl));
        refreshTokenSessionRepository.save(session);
        return new IssuedRefreshToken(rawToken, session.getExpiresAt(), session.getFamilyId(), session.getUserId());
    }

    @Transactional(noRollbackFor = ApiException.class)
    public IssuedRefreshToken refresh(String rawToken, String clientFingerprint) {
        String normalizedToken = normalizeToken(rawToken);
        String tokenHash = hashToken(normalizedToken);
        Long userId = refreshTokenSessionRepository.findUserIdByTokenHash(tokenHash)
            .orElseThrow(this::invalidRefreshToken);
        User user = userRepository.lockById(userId)
            .filter(User::isEnabled)
            .orElseThrow(this::invalidRefreshToken);
        // Lock the session row so one old refresh token can only rotate once.
        RefreshTokenSession session = refreshTokenSessionRepository.findByTokenHashForUpdate(tokenHash)
            .orElseThrow(this::invalidRefreshToken);
        Instant now = Instant.now();

        if (session.isExpired(now)) {
            revokeSession(session, now, REVOCATION_EXPIRED);
            throw invalidRefreshToken();
        }
        if (session.isRevoked()) {
            // Replays now fail closed with 401 instead of revoking the entire family,
            // which avoids invalidating the single winning token in concurrent races.
            throw invalidRefreshToken();
        }
        if (!Objects.equals(session.getUserId(), user.getId())) throw invalidRefreshToken();

        session.setLastUsedAt(now);
        session.setClientFingerprint(sanitizeClientFingerprint(clientFingerprint));

        if (!rotationEnabled) {
            refreshTokenSessionRepository.save(session);
            return new IssuedRefreshToken(normalizedToken, session.getExpiresAt(), session.getFamilyId(), user.getId());
        }

        String rotatedToken = generateOpaqueToken();
        RefreshTokenSession rotatedSession = new RefreshTokenSession();
        rotatedSession.setUserId(user.getId());
        rotatedSession.setTokenHash(hashToken(rotatedToken));
        rotatedSession.setFamilyId(session.getFamilyId());
        rotatedSession.setRotationSourceId(session.getId());
        rotatedSession.setClientFingerprint(sanitizeClientFingerprint(clientFingerprint));
        rotatedSession.setCreatedAt(now);
        rotatedSession.setLastUsedAt(now);
        rotatedSession.setExpiresAt(now.plus(refreshTokenTtl));
        refreshTokenSessionRepository.save(rotatedSession);

        revokeSession(session, now, REVOCATION_ROTATED);
        return new IssuedRefreshToken(rotatedToken, rotatedSession.getExpiresAt(), rotatedSession.getFamilyId(), user.getId());
    }

    @Transactional
    public boolean revoke(String rawToken) {
        Optional<String> normalized = normalizeOptionalToken(rawToken);
        if (normalized.isEmpty()) {
            return false;
        }
        return refreshTokenSessionRepository.findByTokenHash(hashToken(normalized.get()))
            .map(session -> revokeSession(session, Instant.now(), REVOCATION_LOGOUT))
            .orElse(false);
    }

    public Duration getRefreshTokenTtl() {
        return refreshTokenTtl;
    }

    /** Must be called inside the password-reset transaction. */
    public void revokeAllForUser(Long userId, Instant now) {
        refreshTokenSessionRepository.findAllByUserIdAndRevokedAtIsNull(userId).stream()
            .filter(Objects::nonNull)
            .forEach(session -> revokeSession(session, now, REVOCATION_PASSWORD_RESET));
    }

    private void revokeFamily(String familyId, Instant now, String reason) {
        List<RefreshTokenSession> activeSessions = refreshTokenSessionRepository.findAllByFamilyIdAndRevokedAtIsNull(familyId);
        activeSessions.stream()
            .filter(Objects::nonNull)
            .forEach(session -> revokeSession(session, now, reason));
    }

    private boolean revokeSession(RefreshTokenSession session, Instant now, String reason) {
        if (session.isRevoked()) {
            return false;
        }
        session.setRevokedAt(now);
        session.setRevocationReason(reason);
        session.setLastUsedAt(now);
        refreshTokenSessionRepository.save(session);
        return true;
    }

    private String generateOpaqueToken() {
        byte[] tokenBytes = new byte[TOKEN_BYTES];
        secureRandom.nextBytes(tokenBytes);
        return URL_ENCODER.encodeToString(tokenBytes);
    }

    private String generateFamilyId() {
        return UUID.randomUUID().toString().replace("-", "");
    }

    private String hashToken(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HEX_FORMAT.formatHex(digest.digest(normalizeToken(rawToken).getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }

    private String normalizeToken(String rawToken) {
        return normalizeOptionalToken(rawToken).orElseThrow(this::invalidRefreshToken);
    }

    private Optional<String> normalizeOptionalToken(String rawToken) {
        if (rawToken == null) {
            return Optional.empty();
        }
        String normalized = rawToken.trim();
        return normalized.isEmpty() ? Optional.empty() : Optional.of(normalized);
    }

    private String sanitizeClientFingerprint(String clientFingerprint) {
        if (clientFingerprint == null) {
            return null;
        }
        String normalized = clientFingerprint.trim();
        if (normalized.isEmpty()) {
            return null;
        }
        return normalized.length() <= MAX_CLIENT_FINGERPRINT_LENGTH
            ? normalized
            : normalized.substring(0, MAX_CLIENT_FINGERPRINT_LENGTH);
    }

    private ApiException invalidRefreshToken() {
        return new ApiException(ErrorCode.UNAUTHORIZED, "error.auth.invalid_refresh_token");
    }

    public record IssuedRefreshToken(String token, Instant expiresAt, String familyId, Long userId) {
    }
}
