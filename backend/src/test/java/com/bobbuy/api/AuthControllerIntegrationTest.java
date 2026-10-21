package com.bobbuy.api;

import com.bobbuy.service.BobbuyStore;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class AuthControllerIntegrationTest {

  @Autowired
  private MockMvc mockMvc;

  @Autowired
  private BobbuyStore store;

  @Autowired
  private ObjectMapper objectMapper;

  @BeforeEach
  void setUp() {
    store.seed();
  }

  @Test
  void loginReturnsAccessTokenAndSetsRefreshCookies() throws Exception {
    MvcResult result = mockMvc.perform(post("/api/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"username":"agent","password":"agent-pass"}
                """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.accessToken").isString())
        .andExpect(jsonPath("$.data.refreshToken").doesNotExist())
        .andExpect(jsonPath("$.data.accessTokenExpiresAt").isString())
        .andExpect(jsonPath("$.data.refreshTokenExpiresAt").isString())
        .andExpect(jsonPath("$.data.user.id").value(1000))
        .andExpect(jsonPath("$.data.user.username").value("agent"))
        .andExpect(jsonPath("$.data.user.role").value("AGENT"))
        .andReturn();

    List<String> setCookieHeaders = result.getResponse().getHeaders(HttpHeaders.SET_COOKIE);
    org.junit.jupiter.api.Assertions.assertTrue(setCookieHeaders.stream().anyMatch(header ->
        header.startsWith("bobbuy_refresh_token=")
            && header.contains("Path=/api/auth")
            && header.contains("HttpOnly")
            && header.contains("SameSite=Lax")));
    org.junit.jupiter.api.Assertions.assertTrue(setCookieHeaders.stream().anyMatch(header ->
        header.startsWith("bobbuy_csrf_token=")
            && header.contains("Path=/")
            && header.contains("SameSite=Lax")
            && !header.contains("HttpOnly")));
  }

  @Test
  void invalidCredentialsReturnUnauthorized() throws Exception {
    mockMvc.perform(post("/api/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"username":"agent","password":"wrong-password"}
                """))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.errorCode").value("UNAUTHORIZED"));
  }

  @Test
  void meReturnsAuthenticatedUserFromBearerToken() throws Exception {
    String token = loginSession("customer", "customer-pass").accessToken();

    mockMvc.perform(get("/api/auth/me")
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.id").value(1001))
        .andExpect(jsonPath("$.data.username").value("customer"))
        .andExpect(jsonPath("$.data.role").value("CUSTOMER"));
  }

  @Test
  void bearerReadPreservesCsrfCookieForSubsequentRefresh() throws Exception {
    AuthCookies session = loginSession("agent", "agent-pass");
    MvcResult result = mockMvc.perform(get("/api/auth/me")
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + session.accessToken())
            .cookie(session.csrfCookie()))
        .andExpect(status().isOk())
        .andReturn();
    org.junit.jupiter.api.Assertions.assertFalse(
        result.getResponse().getHeaders(HttpHeaders.SET_COOKIE).stream().anyMatch(header ->
            header.startsWith("bobbuy_csrf_token=") && header.contains("Max-Age=0")),
        "Bearer authentication must preserve the browser's refresh CSRF token");
    refreshSession(session);
  }

  @Test
  void refreshReturnsNewAccessAndRefreshTokens() throws Exception {
    AuthCookies loginSession = loginSession("agent", "agent-pass");

    String response = mockMvc.perform(post("/api/auth/refresh")
            .cookie(loginSession.refreshCookie(), loginSession.csrfCookie())
            .header("X-BOBBUY-CSRF-TOKEN", loginSession.csrfToken()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.accessToken").isString())
        .andExpect(jsonPath("$.data.refreshToken").doesNotExist())
        .andExpect(jsonPath("$.data.user.role").value("AGENT"))
        .andReturn()
        .getResponse()
        .getContentAsString();

    JsonNode payload = objectMapper.readTree(response).path("data");
    String rotatedAccessToken = payload.path("accessToken").asText();
    mockMvc.perform(get("/api/users")
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + rotatedAccessToken))
        .andExpect(status().isOk());
    org.junit.jupiter.api.Assertions.assertNotEquals(loginSession.accessToken(), rotatedAccessToken);
  }

  @Test
  void rotatedRefreshTokenCannotBeReusedAndNewRefreshTokenRemainsUsable() throws Exception {
    AuthCookies loginSession = loginSession("agent", "agent-pass");
    AuthCookies refreshedSession = refreshSession(loginSession);

    mockMvc.perform(post("/api/auth/refresh")
            .cookie(loginSession.refreshCookie(), loginSession.csrfCookie())
            .header("X-BOBBUY-CSRF-TOKEN", loginSession.csrfToken()))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.errorCode").value("UNAUTHORIZED"));

    mockMvc.perform(post("/api/auth/refresh")
            .cookie(refreshedSession.refreshCookie(), refreshedSession.csrfCookie())
            .header("X-BOBBUY-CSRF-TOKEN", refreshedSession.csrfToken()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.accessToken").isString());
  }

  @Test
  void logoutRevokesRefreshToken() throws Exception {
    AuthCookies loginSession = loginSession("customer", "customer-pass");

    MvcResult result = mockMvc.perform(post("/api/auth/logout")
            .cookie(loginSession.refreshCookie(), loginSession.csrfCookie())
            .header("X-BOBBUY-CSRF-TOKEN", loginSession.csrfToken()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.revoked").value(true))
        .andReturn();

    List<String> setCookieHeaders = result.getResponse().getHeaders(HttpHeaders.SET_COOKIE);
    org.junit.jupiter.api.Assertions.assertTrue(setCookieHeaders.stream().anyMatch(header ->
        header.startsWith("bobbuy_refresh_token=") && header.contains("Max-Age=0")));
    org.junit.jupiter.api.Assertions.assertTrue(setCookieHeaders.stream().anyMatch(header ->
        header.startsWith("bobbuy_csrf_token=") && header.contains("Max-Age=0")));

    mockMvc.perform(post("/api/auth/refresh")
            .cookie(loginSession.refreshCookie(), loginSession.csrfCookie())
            .header("X-BOBBUY-CSRF-TOKEN", loginSession.csrfToken()))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.errorCode").value("UNAUTHORIZED"));
  }

  @Test
  void missingOrForgedRefreshTokenIsRejected() throws Exception {
    mockMvc.perform(post("/api/auth/refresh"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.errorCode").value("UNAUTHORIZED"));
  }

  @Test
  void missingOrForgedCsrfTokenIsRejected() throws Exception {
    AuthCookies loginSession = loginSession("agent", "agent-pass");

    mockMvc.perform(post("/api/auth/refresh")
            .cookie(loginSession.refreshCookie(), loginSession.csrfCookie()))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.errorCode").value("FORBIDDEN"));

    mockMvc.perform(post("/api/auth/logout")
            .cookie(loginSession.refreshCookie(), loginSession.csrfCookie())
            .header("X-BOBBUY-CSRF-TOKEN", "forged-token"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.errorCode").value("FORBIDDEN"));
  }

  @Test
  void refreshedCustomerTokenKeepsCustomerPermissions() throws Exception {
    AuthCookies loginSession = loginSession("customer", "customer-pass");
    AuthCookies refreshedSession = refreshSession(loginSession);

    mockMvc.perform(get("/api/auth/me")
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + refreshedSession.accessToken()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.role").value("CUSTOMER"));

    mockMvc.perform(get("/api/users")
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + refreshedSession.accessToken()))
        .andExpect(status().isForbidden());
  }

  @Test
  void serviceTokenHeadersCannotRefreshWithoutRefreshToken() throws Exception {
    mockMvc.perform(post("/api/auth/refresh")
            .header("X-BOBBUY-SERVICE-TOKEN", "test-service-token")
            .header("X-BOBBUY-INTERNAL-SERVICE", "auth-service"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.errorCode").value("UNAUTHORIZED"));
  }

  private AuthCookies loginSession(String username, String password) throws Exception {
    MvcResult result = mockMvc.perform(post("/api/auth/login")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {"username":"%s","password":"%s"}
                """.formatted(username, password)))
        .andExpect(status().isOk())
        .andReturn();
    String response = result.getResponse().getContentAsString();
    JsonNode payload = objectMapper.readTree(response).path("data");
    return new AuthCookies(
        payload.path("accessToken").asText(),
        extractCookie(result, "bobbuy_refresh_token"),
        extractCookie(result, "bobbuy_csrf_token")
    );
  }

  private AuthCookies refreshSession(AuthCookies authCookies) throws Exception {
    MvcResult result = mockMvc.perform(post("/api/auth/refresh")
            .cookie(authCookies.refreshCookie(), authCookies.csrfCookie())
            .header("X-BOBBUY-CSRF-TOKEN", authCookies.csrfToken()))
        .andExpect(status().isOk())
        .andReturn();
    String response = result.getResponse().getContentAsString();
    JsonNode payload = objectMapper.readTree(response).path("data");
    return new AuthCookies(
        payload.path("accessToken").asText(),
        extractCookie(result, "bobbuy_refresh_token"),
        extractCookie(result, "bobbuy_csrf_token")
    );
  }

  private String extractCookie(MvcResult result, String cookieName) {
    return result.getResponse().getHeaders(HttpHeaders.SET_COOKIE).stream()
        .filter(header -> header.startsWith(cookieName + "="))
        .map(header -> header.substring(cookieName.length() + 1, header.indexOf(';')))
        .reduce((previous, current) -> current)
        .orElseThrow();
  }

  private record AuthCookies(String accessToken, String refreshToken, String csrfToken) {
    private Cookie refreshCookie() {
      return new Cookie("bobbuy_refresh_token", refreshToken);
    }

    private Cookie csrfCookie() {
      return new Cookie("bobbuy_csrf_token", csrfToken);
    }
  }
}
