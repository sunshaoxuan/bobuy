package com.bobbuy.api;

import com.bobbuy.api.response.ApiException;
import com.bobbuy.api.response.ApiResponse;
import com.bobbuy.api.response.ErrorCode;
import com.bobbuy.security.AuthCookieService;
import com.bobbuy.service.AuthService;
import com.bobbuy.service.AuthAbuseService;
import com.bobbuy.service.PasswordResetService;
import com.bobbuy.security.TrustedClientIpResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Email;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;
    private final AuthCookieService authCookieService;
    private final AuthAbuseService abuse;
    private final TrustedClientIpResolver clientIps;
    private final PasswordResetService passwordResetService;

    public AuthController(AuthService authService, AuthCookieService authCookieService, AuthAbuseService abuse, TrustedClientIpResolver clientIps, PasswordResetService passwordResetService) {
        this.authService = authService;
        this.authCookieService = authCookieService;
        this.abuse=abuse; this.clientIps=clientIps;
        this.passwordResetService=passwordResetService;
    }

    @PostMapping("/forgot-password")
    public ApiResponse<PasswordResetService.ForgotResult> forgotPassword(@Valid @org.springframework.web.bind.annotation.RequestBody ForgotPasswordRequest request, HttpServletRequest servletRequest) {
        var attempt=abuse.begin(AuthAbuseService.Purpose.FORGOT_PASSWORD,clientIps.resolve(servletRequest),request.email());
        var result=passwordResetService.forgot(request.email());
        abuse.succeeded(attempt);
        return ApiResponse.success(result);
    }

    @PostMapping("/reset-password")
    public ApiResponse<PasswordResetService.ResetResult> resetPassword(@Valid @org.springframework.web.bind.annotation.RequestBody ResetPasswordRequest request) {
        return ApiResponse.success(passwordResetService.reset(request.token(),request.newPassword()));
    }

    @PostMapping("/login")
    public ApiResponse<AuthService.SessionResult> login(
        @Valid @org.springframework.web.bind.annotation.RequestBody LoginRequest request,
        HttpServletRequest httpServletRequest,
        HttpServletResponse httpServletResponse
    ) {
        var attempt=abuse.begin(AuthAbuseService.Purpose.LOGIN,clientIps.resolve(httpServletRequest),request.username());
        AuthService.SessionResult sessionResult;
        try { sessionResult=authService.login(request.username(), request.password(), clientFingerprint(httpServletRequest)); }
        catch(RuntimeException failure){abuse.failed(attempt);throw failure;}
        abuse.succeeded(attempt);
        authCookieService.writeRefreshAndCsrfCookies(httpServletResponse, sessionResult.refreshToken(), sessionResult.refreshTokenExpiresAt());
        return ApiResponse.success(sessionResult);
    }

    @PostMapping("/refresh")
    public ApiResponse<AuthService.SessionResult> refresh(HttpServletRequest httpServletRequest, HttpServletResponse httpServletResponse) {
        String refreshToken = authCookieService.resolveRefreshToken(httpServletRequest);
        // CSRF is only required for cookie-backed refresh requests; missing cookie falls through to 401.
        if (refreshToken != null && !authCookieService.isCsrfValid(httpServletRequest)) {
            authCookieService.clearAuthCookies(httpServletResponse);
            throw new ApiException(ErrorCode.FORBIDDEN, "error.auth.invalid_csrf_token");
        }
        try {
            AuthService.SessionResult sessionResult = authService.refresh(refreshToken, clientFingerprint(httpServletRequest));
            authCookieService.writeRefreshAndCsrfCookies(
                httpServletResponse,
                sessionResult.refreshToken(),
                sessionResult.refreshTokenExpiresAt(),
                authCookieService.resolveCsrfCookieToken(httpServletRequest)
            );
            return ApiResponse.success(sessionResult);
        } catch (RuntimeException ex) {
            authCookieService.clearAuthCookies(httpServletResponse);
            throw ex;
        }
    }

    @PostMapping("/logout")
    public ApiResponse<AuthService.LogoutResult> logout(HttpServletRequest httpServletRequest, HttpServletResponse httpServletResponse) {
        String refreshToken = authCookieService.resolveRefreshToken(httpServletRequest);
        if (refreshToken != null && !authCookieService.isCsrfValid(httpServletRequest)) {
            authCookieService.clearAuthCookies(httpServletResponse);
            throw new ApiException(ErrorCode.FORBIDDEN, "error.auth.invalid_csrf_token");
        }
        try {
            return ApiResponse.success(authService.logout(refreshToken));
        } finally {
            authCookieService.clearAuthCookies(httpServletResponse);
        }
    }

    @GetMapping("/me")
    public ApiResponse<AuthService.UserProfile> currentUser(Authentication authentication) {
        return ApiResponse.success(authService.currentUser(authentication));
    }

    private String clientFingerprint(HttpServletRequest request) {
        return request.getHeader(HttpHeaders.USER_AGENT);
    }

    public record LoginRequest(@NotBlank String username, @NotBlank String password) {
    }
    public record ForgotPasswordRequest(@NotBlank @Email String email) {}
    public record ResetPasswordRequest(@NotBlank String token, @NotBlank String newPassword) {}

}
