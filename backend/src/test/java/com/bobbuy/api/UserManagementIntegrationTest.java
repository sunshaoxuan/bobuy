package com.bobbuy.api;

import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.bobbuy.security.JwtTokenService;
import com.bobbuy.service.BobbuyStore;
import com.fasterxml.jackson.databind.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.web.servlet.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class UserManagementIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired BobbuyStore store;
    @Autowired UserRepository users;
    @Autowired EmailChallengeRepository challenges;
    @Autowired MerchantCustomerRepository relations;
    @Autowired JwtTokenService tokens;
    @MockBean JavaMailSender mail;
    String admin;

    @BeforeEach void setup() {
        challenges.deleteAll(); relations.deleteAll(); store.seed();
        admin = tokens.createAccessToken(users.findById(1000L).orElseThrow());
    }
    @AfterEach void cleanup() { challenges.deleteAll(); relations.deleteAll(); }
    Map<String,Object> edit(String username, List<String> roles) {
        return new HashMap<>(Map.of("username", username, "name", "Account " + username, "email", username + "@example.com",
            "password", "valid-password", "roles", roles, "enabled", true));
    }
    ResultActions create(Map<String,Object> body, String token) throws Exception {
        return mvc.perform(post("/api/admin/users").header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
    }
    ResultActions update(long id, Map<String,Object> body) throws Exception {
        return mvc.perform(put("/api/admin/users/" + id).header("Authorization", "Bearer " + admin)
            .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
    }
    long id(ResultActions result) throws Exception { return json.readTree(result.andReturn().getResponse().getContentAsString()).at("/data/id").asLong(); }

    @Test void platformCreatesAllCombinationsAndProtectsGlobalAccess() throws Exception {
        for (var roles : List.of(List.of("CUSTOMER"), List.of("AGENT"), List.of("CUSTOMER", "AGENT"))) {
            var body = edit("account_" + roles.size() + roles.get(0).toLowerCase(), roles);
            body.put("platformAdmin", true); body.put("passwordHash", "injected"); body.put("emailVerified", true);
            long id = id(create(body, admin).andExpect(status().isOk()).andExpect(jsonPath("$.data.roles.length()").value(roles.size()))
                .andExpect(jsonPath("$.data.platformAdmin").value(false)).andExpect(jsonPath("$.data.emailVerified").value(false))
                .andExpect(jsonPath("$.data.passwordHash").doesNotExist()).andExpect(jsonPath("$.data.password").doesNotExist()));
            String token = tokens.createAccessToken(users.findById(id).orElseThrow());
            mvc.perform(get("/api/admin/users").header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
            create(edit("attack", List.of("AGENT")), token).andExpect(status().isForbidden());
            mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("username", body.get("username"), "password", "valid-password"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.user.roles.length()").value(roles.size()));
        }
        create(edit("empty", List.of()), admin).andExpect(status().isBadRequest());
        create(edit("unknown", List.of("PLATFORM_ADMIN")), admin).andExpect(status().isBadRequest());
        // Test profile injects CUSTOMER for requests without a bearer token.
        mvc.perform(get("/api/admin/users")).andExpect(status().isForbidden());
    }

    @Test void editPreservesProfileAndPasswordAndRevokesExistingTokenImmediately() throws Exception {
        var body = edit("dual_edit", List.of("CUSTOMER", "AGENT"));
        long id = id(create(body, admin).andExpect(status().isOk()));
        User user = users.findById(id).orElseThrow();
        String originalHash = user.getPasswordHash(); user.setNote("Preserve profile");
        user.setEmailVerifiedAt(java.time.Instant.now()); users.save(user);
        String token = tokens.createAccessToken(user);
        mvc.perform(get("/api/mobile/products").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        body.put("password", ""); body.put("roles", List.of("CUSTOMER"));
        update(id, body).andExpect(status().isOk());
        User saved = users.findById(id).orElseThrow();
        assertThat(saved.getPasswordHash()).isEqualTo(originalHash);
        assertThat(saved.getNote()).isEqualTo("Preserve profile");
        assertThat(saved.getEmailVerifiedAt()).isNotNull();
        mvc.perform(get("/api/mobile/products").header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        body.put("email", "changed@example.com"); body.put("password", "replacement-pass");
        update(id, body).andExpect(status().isOk()).andExpect(jsonPath("$.data.emailVerified").value(false));
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"username\":\"dual_edit\",\"password\":\"valid-password\"}"))
            .andExpect(status().isUnauthorized());
        body.put("enabled", false); update(id, body).andExpect(status().isOk());
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
    }

    @Test void validationRejectsDuplicatesShortPasswordsAndSelfDisable() throws Exception {
        var body = edit("unique", List.of("CUSTOMER"));
        create(body, admin).andExpect(status().isOk());
        body.put("username", "UNIQUE"); create(body, admin).andExpect(status().isBadRequest());
        body.put("username", "other"); create(body, admin).andExpect(status().isBadRequest());
        body.put("email", "other@example.com"); body.put("password", "short"); create(body, admin).andExpect(status().isBadRequest());
        var own = edit("agent", List.of("AGENT")); own.put("enabled", false);
        update(1000L, own).andExpect(status().isBadRequest());
        assertThat(users.findById(1000L).orElseThrow().isEnabled()).isTrue();
    }

    @Test void checkoutAlwaysRegistersCustomerAndIndependentRegistrationAllowsBothWithoutAdmin() throws Exception {
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
            .content("{\"username\":\"checkout_safe\",\"password\":\"valid-password\",\"email\":\"checkout_safe@example.com\",\"roles\":[\"AGENT\"],\"platformAdmin\":true}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.user.roles[0]").value("CUSTOMER"))
            .andExpect(jsonPath("$.data.user.roles.length()").value(1)).andExpect(jsonPath("$.data.user.platformAdmin").value(false));
        var request = Map.of("account", Map.of("username", "public_dual", "password", "valid-password", "email", "public_dual@example.com"), "roles", List.of("CUSTOMER", "AGENT"), "platformAdmin", true);
        var response = mvc.perform(post("/api/auth/register-account").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.user.roles.length()").value(2)).andExpect(jsonPath("$.data.user.platformAdmin").value(false)).andReturn();
        String token = json.readTree(response.getResponse().getContentAsString()).at("/data/accessToken").asText();
        mvc.perform(get("/api/admin/users").header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        mvc.perform(post("/api/checkout").header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(Map.of("requestId", UUID.randomUUID(), "tripId", 2000, "items", List.of(Map.of("productId", "prd-1000", "quantity", 1))))))
            .andExpect(status().isOk());
        mvc.perform(get("/api/customer/orders").header("Authorization", "Bearer " + token)).andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(1));
        mvc.perform(get("/api/customer/trips").header("Authorization", "Bearer " + token)).andExpect(status().isOk()).andExpect(jsonPath("$.data.length()").value(1));
        mvc.perform(get("/api/orders").header("Authorization", "Bearer " + token)).andExpect(status().isOk()).andExpect(jsonPath("$.data").isEmpty());
        mvc.perform(get("/api/trips").header("Authorization", "Bearer " + token)).andExpect(status().isOk()).andExpect(jsonPath("$.data").isEmpty());
        mvc.perform(get("/api/customer/procurement/2000/ledger").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        String merchantToken = tokens.createAccessToken(users.findById(1000L).orElseThrow());
        mvc.perform(get("/api/customer/orders").header("Authorization", "Bearer " + merchantToken)).andExpect(status().isForbidden());
    }
}
