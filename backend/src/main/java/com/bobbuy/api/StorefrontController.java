package com.bobbuy.api;

import com.bobbuy.api.response.ApiResponse;
import com.bobbuy.security.AuthCookieService;
import com.bobbuy.service.AuthService;
import com.bobbuy.service.StorefrontService;
import com.bobbuy.service.AuthAbuseService;
import com.bobbuy.security.TrustedClientIpResolver;
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
    private final AuthAbuseService abuse; private final TrustedClientIpResolver clientIps;
    public StorefrontController(StorefrontService storefront, AuthService auth, AuthCookieService cookies, AuthAbuseService abuse, TrustedClientIpResolver clientIps) {
        this.storefront = storefront; this.auth = auth; this.cookies = cookies; this.abuse=abuse;this.clientIps=clientIps;
    }
    @GetMapping("/api/storefront/trips")
    public ApiResponse<List<StorefrontService.PublicTrip>> trips(@RequestParam(defaultValue = "false") boolean includeCurrent) {
        return ApiResponse.success(storefront.publicTrips(includeCurrent));
    }
    @GetMapping("/api/storefront/products")
    public ApiResponse<List<StorefrontService.PublicProduct>> products() { return ApiResponse.success(storefront.publicProducts()); }
    @GetMapping("/api/storefront/product-sales")
    public ApiResponse<List<StorefrontService.PublicProduct>> productSales(@RequestParam(defaultValue="") List<String> productIds) { return ApiResponse.success(storefront.publicProducts(productIds)); }
    @PostMapping("/api/auth/register")
    public ApiResponse<AuthService.SessionResult> register(@Valid @RequestBody StorefrontService.Registration request,
            HttpServletRequest httpRequest, HttpServletResponse response) {
        var attempt=abuse.begin(AuthAbuseService.Purpose.REGISTER,clientIps.resolve(httpRequest),request.email());
        try{storefront.register(request);}catch(RuntimeException failure){abuse.failed(attempt);throw failure;}abuse.succeeded(attempt);
        var session = auth.login(request.username(), request.password(), httpRequest.getHeader("User-Agent"));
        cookies.writeRefreshAndCsrfCookies(response, session.refreshToken(), session.refreshTokenExpiresAt());
        return ApiResponse.success(session);
    }
    @PostMapping("/api/auth/email/resend")
    public ApiResponse<Boolean> resend(Authentication authentication,HttpServletRequest request) { var a=abuse.begin(AuthAbuseService.Purpose.VERIFICATION_RESEND,clientIps.resolve(request),authentication.getName());try{storefront.resend(authentication);}catch(RuntimeException failure){abuse.failed(a);throw failure;}abuse.succeeded(a);return ApiResponse.success(true); }
    @PostMapping("/api/auth/register-account")
    public ApiResponse<AuthService.SessionResult> registerAccount(@Valid @RequestBody StorefrontService.AccountRegistration request,
            HttpServletRequest httpRequest, HttpServletResponse response) {
        var attempt=abuse.begin(AuthAbuseService.Purpose.REGISTER,clientIps.resolve(httpRequest),request.account().email());
        try{storefront.registerAccount(request);}catch(RuntimeException failure){abuse.failed(attempt);throw failure;}abuse.succeeded(attempt);
        var session = auth.login(request.account().username(), request.account().password(), httpRequest.getHeader("User-Agent"));
        cookies.writeRefreshAndCsrfCookies(response, session.refreshToken(), session.refreshTokenExpiresAt());
        return ApiResponse.success(session);
    }
    @PostMapping("/api/auth/email/verify")
    public ApiResponse<Boolean> verify(Authentication authentication, @Valid @RequestBody Verification request,HttpServletRequest httpRequest) {
        var a=abuse.begin(AuthAbuseService.Purpose.VERIFICATION_VERIFY,clientIps.resolve(httpRequest),authentication.getName());try{storefront.verify(authentication, request.code());}catch(RuntimeException failure){abuse.failed(a);throw failure;}abuse.succeeded(a);return ApiResponse.success(true);
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
