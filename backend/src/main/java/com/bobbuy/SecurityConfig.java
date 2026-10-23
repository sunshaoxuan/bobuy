package com.bobbuy;

import com.bobbuy.api.response.ApiError;
import com.bobbuy.api.response.ErrorCode;
import com.bobbuy.security.RoleInjectionFilter;
import com.bobbuy.security.AuthCookieService;
import com.bobbuy.security.InternalServiceTokenFilter;
import com.bobbuy.security.TokenAuthenticationFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.session.NullAuthenticatedSessionStrategy;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.InvalidCsrfTokenException;
import org.springframework.security.web.csrf.MissingCsrfTokenException;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Stream;

@Configuration
@EnableWebSecurity
public class SecurityConfig {
    private final InternalServiceTokenFilter internalServiceTokenFilter;
    private final TokenAuthenticationFilter tokenAuthenticationFilter;
    private final RoleInjectionFilter roleInjectionFilter;
    private final AuthCookieService authCookieService;
    private final MessageSource messageSource;
    private final ObjectMapper objectMapper;
    private final List<String> allowedOriginPatterns;

    public SecurityConfig(InternalServiceTokenFilter internalServiceTokenFilter,
                          TokenAuthenticationFilter tokenAuthenticationFilter,
                          RoleInjectionFilter roleInjectionFilter,
                          AuthCookieService authCookieService,
                          MessageSource messageSource,
                          ObjectMapper objectMapper,
                          @Value("${bobbuy.security.cors.allowed-origin-patterns:http://localhost,http://127.0.0.1,http://localhost:4173,http://127.0.0.1:4173,http://localhost:5173,http://127.0.0.1:5173}") String allowedOriginPatterns) {
        this.internalServiceTokenFilter = internalServiceTokenFilter;
        this.tokenAuthenticationFilter = tokenAuthenticationFilter;
        this.roleInjectionFilter = roleInjectionFilter;
        this.authCookieService = authCookieService;
        this.messageSource = messageSource;
        this.objectMapper = objectMapper;
        this.allowedOriginPatterns = Stream.of(allowedOriginPatterns.split(","))
            .map(String::trim)
            .filter(value -> !value.isEmpty())
            .toList();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .httpBasic(AbstractHttpConfigurer::disable)
            .formLogin(AbstractHttpConfigurer::disable)
            .csrf(csrf -> csrf
                .csrfTokenRepository(csrfTokenRepository())
                .csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler())
                // AuthCookieService owns token issuance and clearing for stateless JWT sessions.
                .sessionAuthenticationStrategy(new NullAuthenticatedSessionStrategy())
                .requireCsrfProtectionMatcher(cookieBackedAuthMutationMatcher())
            )
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .exceptionHandling(exceptions -> exceptions
                .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED))
                .accessDeniedHandler(accessDeniedHandler())
            )
            .addFilterBefore(internalServiceTokenFilter, AnonymousAuthenticationFilter.class)
            .addFilterBefore(tokenAuthenticationFilter, AnonymousAuthenticationFilter.class)
            .addFilterBefore(roleInjectionFilter, AnonymousAuthenticationFilter.class)
                .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers("/api/health/**").permitAll()
                .requestMatchers("/api/actuator/health/**").permitAll()
                .requestMatchers("/actuator/health/**").permitAll()
                .requestMatchers("/internal/**").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/register").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/register-account").permitAll()
                .requestMatchers("/api/customer/**").hasRole("CUSTOMER")
                .requestMatchers(HttpMethod.GET, "/api/storefront/**").permitAll()
                .requestMatchers("/api/checkout/**").hasRole("CUSTOMER")
                .requestMatchers("/api/auth/email/**").authenticated()
                .requestMatchers("/api/merchant/**").hasRole("AGENT")
                .requestMatchers(HttpMethod.POST, "/api/orders/*/quick-order").hasRole("AGENT")
                .requestMatchers(HttpMethod.POST, "/api/auth/refresh").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/auth/logout").permitAll()
                .requestMatchers("/ws", "/ws/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/procurement/*/ledger").hasAnyRole("CUSTOMER", "AGENT")
                .requestMatchers(HttpMethod.POST, "/api/procurement/*/ledger/*/confirm").hasAnyRole("CUSTOMER", "AGENT")
                .requestMatchers("/api/procurement/**").hasRole("AGENT")
                .requestMatchers("/api/admin/users/**").hasRole("PLATFORM_ADMIN")
                .requestMatchers(HttpMethod.GET, "/api/users/**").hasRole("AGENT")
                .requestMatchers("/api/users/**").denyAll()
                .requestMatchers("/api/audit-logs/**").hasRole("AGENT")
                .requestMatchers("/api/metrics/**").hasRole("AGENT")
                .requestMatchers(HttpMethod.PATCH, "/api/mobile/products/**").hasRole("AGENT")
                .requestMatchers("/api/mobile/**").hasRole("AGENT")
                .requestMatchers("/api/ai/**").hasRole("AGENT")
                .requestMatchers(HttpMethod.GET, "/api/trips/*/procurement-list").hasRole("AGENT")
                .requestMatchers("/api/financial/audit/**").hasRole("AGENT")
                .requestMatchers(HttpMethod.POST, "/api/trips/**").hasRole("AGENT")
                .requestMatchers(HttpMethod.PUT, "/api/trips/**").hasRole("AGENT")
                .requestMatchers(HttpMethod.PATCH, "/api/trips/**").hasRole("AGENT")
                .requestMatchers(HttpMethod.DELETE, "/api/trips/**").hasRole("AGENT")
                .requestMatchers(HttpMethod.GET, "/api/orders/**").hasAnyRole("CUSTOMER", "AGENT")
                .requestMatchers(HttpMethod.POST, "/api/orders").hasRole("AGENT")
                .requestMatchers(HttpMethod.PUT, "/api/orders/**").hasRole("AGENT")
                .requestMatchers(HttpMethod.DELETE, "/api/orders/**").hasRole("AGENT")
                .requestMatchers(HttpMethod.PATCH, "/api/orders/**").hasRole("AGENT")
                .anyRequest().authenticated()
            );
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CsrfTokenRepository csrfTokenRepository() {
        CookieCsrfTokenRepository repository = CookieCsrfTokenRepository.withHttpOnlyFalse();
        repository.setCookieName(authCookieService.getCsrfCookieName());
        repository.setHeaderName(authCookieService.getCsrfHeaderName());
        repository.setCookiePath(authCookieService.getCsrfCookiePath());
        repository.setSecure(authCookieService.isSecureCookie());
        return repository;
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(allowedOriginPatterns.isEmpty() ? Arrays.asList("http://localhost", "http://127.0.0.1") : allowedOriginPatterns);
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("*"));
        configuration.setAllowCredentials(true);
        configuration.setExposedHeaders(Arrays.asList("X-Trace-Id"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    private RequestMatcher cookieBackedAuthMutationMatcher() {
        return request -> isCookieBackedAuthMutation(request)
            && HttpMethod.POST.matches(request.getMethod())
            && authCookieService.resolveRefreshToken(request) != null;
    }

    private boolean isCookieBackedAuthMutation(HttpServletRequest request) {
        String requestUri = request.getRequestURI();
        return "/api/auth/refresh".equals(requestUri) || "/api/auth/logout".equals(requestUri);
    }

    private AccessDeniedHandler accessDeniedHandler() {
        return (request, response, accessDeniedException) -> {
            if (accessDeniedException instanceof MissingCsrfTokenException || accessDeniedException instanceof InvalidCsrfTokenException) {
                writeForbiddenError(response, "error.auth.invalid_csrf_token");
                return;
            }
            // Keep authorization failures out of an unauthenticated /error redispatch.
            response.setStatus(HttpStatus.FORBIDDEN.value());
        };
    }

    private void writeForbiddenError(jakarta.servlet.http.HttpServletResponse response, String messageKey) throws IOException {
        String message = messageSource.getMessage(messageKey, null, LocaleContextHolder.getLocale());
        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getWriter(), new ApiError(ErrorCode.FORBIDDEN.name(), message));
    }
}
