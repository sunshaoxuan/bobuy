package com.bobbuy.service;

import com.bobbuy.api.response.*;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.util.*;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PasswordResetService {
    private static final int TOKEN_BYTES = 48;
    private static final Base64.Encoder URL_ENCODER = Base64.getUrlEncoder().withoutPadding();
    private final PasswordResetTokenRepository tokens;
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final RefreshTokenService refreshTokens;
    private final MailSettingsService mail;
    private final AccountMailProperties properties;
    private final ApplicationEventPublisher events;
    private final SecureRandom random = new SecureRandom();

    public PasswordResetService(PasswordResetTokenRepository tokens, UserRepository users,
            PasswordEncoder passwords, RefreshTokenService refreshTokens,
            MailSettingsService mail, AccountMailProperties properties, ApplicationEventPublisher events) {
        this.tokens=tokens; this.users=users; this.passwords=passwords;
        this.refreshTokens=refreshTokens; this.mail=mail; this.properties=properties; this.events=events;
    }

    /** Always returns the same result; delivery eligibility is deliberately not observable. */
    @Transactional
    public ForgotResult forgot(String email) {
        if (!properties.isPasswordResetEnabled() || !properties.isDeliveryEnabled() || !mail.protectedDeliveryReady())
            return new ForgotResult(true);
        users.findByEmailIgnoreCase(normalizeEmail(email)).filter(User::isEnabled).ifPresent(found -> {
            User locked=users.lockById(found.getId()).filter(User::isEnabled).orElse(null);
            if (locked!=null) issue(locked);
        });
        return new ForgotResult(true);
    }

    private void issue(User user) {
        String raw=generateToken();
        PasswordResetToken token=new PasswordResetToken();
        token.setUserId(user.getId()); token.setTokenHash(hash(raw));
        token.setEmailHash(hash(normalizeEmail(user.getEmail()).toLowerCase(Locale.ROOT)));
        token.setCreatedAt(Instant.now()); token.setExpiresAt(token.getCreatedAt().plus(properties.getPasswordResetLinkTtl()));
        tokens.deleteAllByUserIdAndConsumedAtIsNull(user.getId());
        tokens.saveAndFlush(token);
        SimpleMailMessage message=new SimpleMailMessage();
        message.setTo(user.getEmail());
        String base=properties.getPublicBaseUrl().resolve("/reset-password").toString();
        // A fragment is not sent in HTTP requests, so the token cannot enter access logs or Referer headers.
        String link=base+"#token="+URLEncoder.encode(raw,StandardCharsets.UTF_8);
        PasswordResetMailTemplate.apply(message, link, LocaleContextHolder.getLocale(), properties.getPasswordResetLinkTtl());
        events.publishEvent(new PasswordResetMailRequested(token.getTokenHash(), message));
    }

    @Transactional
    public ResetResult reset(String rawToken, String newPassword) {
        if (!properties.isPasswordResetEnabled()) throw invalidToken();
        validatePassword(newPassword);
        String tokenHash=hash(normalizeToken(rawToken));
        Long userId=tokens.findUserIdByTokenHash(tokenHash).orElseThrow(this::invalidToken);
        User user=users.lockById(userId).filter(User::isEnabled).orElseThrow(this::invalidToken);
        PasswordResetToken token=tokens.findByTokenHashForUpdate(tokenHash).orElseThrow(this::invalidToken);
        Instant now=Instant.now();
        if (token.getConsumedAt()!=null || !token.getExpiresAt().isAfter(now)) throw invalidToken();
        if (!Objects.equals(token.getUserId(),user.getId()) ||
                !MessageDigest.isEqual(token.getEmailHash().getBytes(StandardCharsets.US_ASCII),
                    hash(normalizeEmail(user.getEmail()).toLowerCase(Locale.ROOT)).getBytes(StandardCharsets.US_ASCII))) throw invalidToken();
        token.setConsumedAt(now); user.setPasswordHash(passwords.encode(newPassword));
        tokens.deleteAllByUserIdAndConsumedAtIsNull(user.getId()); users.save(user); refreshTokens.revokeAllForUser(user.getId(),now);
        return new ResetResult(true);
    }

    private void validatePassword(String password) {
        if (password==null || password.length()<8 || password.getBytes(StandardCharsets.UTF_8).length>72)
            throw new ApiException(ErrorCode.INVALID_REQUEST,"error.auth.password_policy");
    }
    private String generateToken(){byte[] bytes=new byte[TOKEN_BYTES];random.nextBytes(bytes);return URL_ENCODER.encodeToString(bytes);}
    private String normalizeToken(String value){if(value==null||value.isBlank())throw invalidToken();return value.trim();}
    private String normalizeEmail(String value){return value==null?"":value.trim();}
    private String hash(String value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}}
    private ApiException invalidToken(){return new ApiException(ErrorCode.INVALID_REQUEST,"error.auth.invalid_password_reset_token");}
    public record ForgotResult(boolean accepted) {}
    public record ResetResult(boolean reset) {}
    public record PasswordResetMailRequested(String tokenHash, SimpleMailMessage message) {}
}
