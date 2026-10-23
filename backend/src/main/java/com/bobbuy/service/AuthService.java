package com.bobbuy.service;

import com.bobbuy.api.response.ApiException;
import com.bobbuy.api.response.ErrorCode;
import com.bobbuy.model.User;
import com.bobbuy.repository.UserRepository;
import com.bobbuy.security.BobbuyAuthenticatedUser;
import com.bobbuy.security.JwtTokenService;
import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.Instant;
import java.util.Optional;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenService jwtTokenService;
    private final RefreshTokenService refreshTokenService;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtTokenService jwtTokenService,
                       RefreshTokenService refreshTokenService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenService = jwtTokenService;
        this.refreshTokenService = refreshTokenService;
    }

    public SessionResult login(String username, String password, String clientFingerprint) {
        User user = userRepository.findByUsernameIgnoreCase(username == null ? "" : username.trim())
            .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED, "error.auth.invalid_credentials"));
        if (!user.isEnabled()) {
            throw new ApiException(ErrorCode.UNAUTHORIZED, "error.auth.user_disabled");
        }
        if (user.getPasswordHash() == null || !passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new ApiException(ErrorCode.UNAUTHORIZED, "error.auth.invalid_credentials");
        }
        return createSessionResult(user, refreshTokenService.issue(user, clientFingerprint));
    }

    public SessionResult refresh(String refreshToken, String clientFingerprint) {
        RefreshTokenService.IssuedRefreshToken issuedRefreshToken = refreshTokenService.refresh(refreshToken, clientFingerprint);
        User user = userRepository.findById(issuedRefreshToken.userId())
            .filter(User::isEnabled)
            .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED, "error.auth.invalid_refresh_token"));
        return createSessionResult(user, issuedRefreshToken);
    }

    public LogoutResult logout(String refreshToken) {
        return new LogoutResult(refreshTokenService.revoke(refreshToken));
    }

    public UserProfile currentUser(Authentication authentication) {
        User user = resolveUser(authentication)
            .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED, "error.auth.invalid_credentials"));
        if (!user.isEnabled()) {
            throw new ApiException(ErrorCode.UNAUTHORIZED, "error.auth.user_disabled");
        }
        return toUserProfile(user);
    }

    private Optional<User> resolveUser(Authentication authentication) {
        if (authentication == null || authentication.getPrincipal() == null) {
            return Optional.empty();
        }
        Object principal = authentication.getPrincipal();
        if (principal instanceof BobbuyAuthenticatedUser authenticatedUser && authenticatedUser.id() != null) {
            return userRepository.findById(authenticatedUser.id());
        }
        try {
            return userRepository.findById(Long.parseLong(authentication.getName()));
        } catch (NumberFormatException ex) {
            return Optional.empty();
        }
    }

    private UserProfile toUserProfile(User user) {
        return new UserProfile(user.getId(), user.getUsername(), user.getName(), user.getRoles(),
            user.getEmail(), user.getEmailVerifiedAt() != null, user.isPlatformAdmin());
    }

    private SessionResult createSessionResult(User user, RefreshTokenService.IssuedRefreshToken issuedRefreshToken) {
        JwtTokenService.IssuedAccessToken accessToken = jwtTokenService.createAccessTokenDetails(user);
        return new SessionResult(
            accessToken.token(),
            accessToken.expiresAt(),
            issuedRefreshToken.token(),
            issuedRefreshToken.expiresAt(),
            toUserProfile(user)
        );
    }

    public record SessionResult(
        String accessToken,
        Instant accessTokenExpiresAt,
        @JsonIgnore
        String refreshToken,
        Instant refreshTokenExpiresAt,
        UserProfile user
    ) {
    }

    public record LogoutResult(boolean revoked) {
    }

    public record UserProfile(Long id, String username, String name, java.util.Set<com.bobbuy.model.Role> roles, String email, boolean emailVerified, boolean platformAdmin) {
    }
}
