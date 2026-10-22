package com.bobbuy.api;

import com.bobbuy.api.response.ApiResponse;
import com.bobbuy.security.AuthCookieService;
import com.bobbuy.service.AuthService;
import com.bobbuy.service.StorefrontService;
import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
public class StorefrontController {
    private final StorefrontService storefront;
    private final AuthService auth;
    private final AuthCookieService cookies;
    public StorefrontController(StorefrontService storefront, AuthService auth, AuthCookieService cookies) {
        this.storefront = storefront; this.auth = auth; this.cookies = cookies;
    }
    @GetMapping("/api/storefront/trips")
    public ApiResponse<List<StorefrontService.PublicTrip>> trips() { return ApiResponse.success(storefront.publicTrips()); }
    @GetMapping("/api/storefront/products")
    public ApiResponse<List<StorefrontService.PublicProduct>> products() { return ApiResponse.success(storefront.publicProducts()); }
    @PostMapping("/api/auth/register")
    public ApiResponse<AuthService.SessionResult> register(@Valid @RequestBody StorefrontService.Registration request,
            HttpServletRequest httpRequest, HttpServletResponse response) {
        storefront.register(request);
        var session = auth.login(request.username(), request.password(), httpRequest.getHeader("User-Agent"));
        cookies.writeRefreshAndCsrfCookies(response, session.refreshToken(), session.refreshTokenExpiresAt());
        return ApiResponse.success(session);
    }
    @PostMapping("/api/auth/email/resend")
    public ApiResponse<Boolean> resend(Authentication authentication) { storefront.resend(authentication); return ApiResponse.success(true); }
    @PostMapping("/api/auth/email/verify")
    public ApiResponse<Boolean> verify(Authentication authentication, @Valid @RequestBody Verification request) {
        storefront.verify(authentication, request.code()); return ApiResponse.success(true);
    }
    @PostMapping("/api/checkout")
    public ApiResponse<StorefrontService.CheckoutResult> checkout(Authentication authentication, @Valid @RequestBody StorefrontService.Checkout request) {
        return ApiResponse.success(storefront.checkout(authentication, request));
    }
    @GetMapping("/api/merchant/customers")
    public ApiResponse<List<StorefrontService.CustomerRelation>> customers(Authentication authentication) {
        return ApiResponse.success(storefront.customers(authentication));
    }
    @PostMapping("/api/merchant/customers/{id}/approve")
    public ApiResponse<Boolean> approve(Authentication authentication, @PathVariable Long id) {
        storefront.approve(authentication, id); return ApiResponse.success(true);
    }
    public record Verification(@jakarta.validation.constraints.NotBlank @Pattern(regexp = "[0-9]{6}") String code) {}
}
