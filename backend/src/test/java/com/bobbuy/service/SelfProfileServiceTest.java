package com.bobbuy.service;

import com.bobbuy.api.response.ApiException;
import com.bobbuy.model.*;
import com.bobbuy.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.validation.Validation;
import jakarta.validation.ValidatorFactory;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.security.core.Authentication;
import org.springframework.test.util.ReflectionTestUtils;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** No Spring context, datasource, seed, mail or business data is used by this test. */
class SelfProfileServiceTest {
    static ValidatorFactory validation;
    final ObjectMapper json = new ObjectMapper();
    UserRepository users;
    EmailChallengeRepository challenges;
    EntityManager em;
    AuthService auth;
    Authentication authentication;
    SelfProfileService profiles;
    User user;
    @BeforeAll static void validator() { validation = Validation.buildDefaultValidatorFactory(); }
    @AfterAll static void closeValidator() { validation.close(); }
    @BeforeEach void setup() {
        users = mock(UserRepository.class); challenges = mock(EmailChallengeRepository.class); em = mock(EntityManager.class);
        auth = mock(AuthService.class); authentication = mock(Authentication.class);
        profiles = new SelfProfileService(users, challenges, auth, validation.getValidator());
        ReflectionTestUtils.setField(profiles, "entityManager", em);
        user = new User(1L, "Name", Role.CUSTOMER, 0); user.setEmail("first@example.com"); user.setUsername("first");
        when(auth.currentUser(authentication)).thenReturn(new AuthService.UserProfile(1L, "first", "Name", Set.of(Role.CUSTOMER), "first@example.com", false, false));
        when(users.lockById(1L)).thenReturn(Optional.of(user)); when(users.findById(1L)).thenReturn(Optional.of(user));
        when(challenges.findById(1L)).thenReturn(Optional.empty());
    }
    SelfProfileService.Patch patch(String body) throws Exception { return json.readValue(body, SelfProfileService.Patch.class); }

    @Test void rejectsUnknownIdentityAndNestedVerificationFields() throws Exception {
        for (String field : List.of("id", "userId", "roles", "platformAdmin", "merchantId", "username", "emailVerified", "note")) {
            assertThatThrownBy(() -> patch("{\"" + field + "\":null}")).isInstanceOf(Exception.class);
        }
        var request = patch("{\"socialAccounts\":[{\"platform\":\"Line\",\"handle\":\"x\",\"verified\":true}]}");
        assertThatThrownBy(() -> profiles.patch(authentication, request)).isInstanceOf(ApiException.class);
        verify(users, never()).saveAndFlush(any());
    }

    @Test void refreshesLockedEntityBeforeApplyingOnlyPresentFields() throws Exception {
        Instant verified = Instant.now();
        doAnswer(invocation -> {user.setEmail("concurrent@example.com");user.setEmailVerifiedAt(verified);return null;})
            .when(em).refresh(user, LockModeType.PESSIMISTIC_WRITE);
        var result = profiles.patch(authentication, patch("{\"phone\":\" 123 \"}"));
        assertThat(result.email()).isEqualTo("concurrent@example.com"); assertThat(result.emailVerified()).isTrue();
        assertThat(result.phone()).isEqualTo("123");
        verify(em).refresh(user, LockModeType.PESSIMISTIC_WRITE);
    }

    @Test void changingEmailPreservesThrottleButSameNormalizedEmailKeepsVerification() throws Exception {
        var challenge = new EmailChallenge(); challenge.userId = 1L; challenge.sentAt = Instant.now(); challenge.expiresAt = challenge.sentAt.plusSeconds(600); challenge.codeHash = "hash";
        when(challenges.findById(1L)).thenReturn(Optional.of(challenge));
        user.setEmailVerifiedAt(Instant.now()); Instant sentAt = challenge.sentAt;
        assertThat(profiles.patch(authentication, patch("{\"email\":\" FIRST@EXAMPLE.COM \"}")).emailVerified()).isTrue();
        verify(challenges, never()).save(any());
        var result = profiles.patch(authentication, patch("{\"email\":\" NEW@EXAMPLE.COM \"}"));
        assertThat(result.email()).isEqualTo("new@example.com"); assertThat(result.emailVerified()).isFalse();
        assertThat(challenge.sentAt).isEqualTo(sentAt); assertThat(challenge.expiresAt).isEqualTo(Instant.EPOCH); assertThat(challenge.attempts).isEqualTo(5);
        verify(challenges, never()).delete(any());
    }

    @Test void duplicateInvalidOrNonStringEmailIsRejected() throws Exception {
        when(users.existsByEmailIgnoreCase("taken@example.com")).thenReturn(true);
        for (String body : List.of("{\"email\":\" TAKEN@EXAMPLE.COM \"}", "{\"email\":null}", "{\"email\":\"bad\"}", "{\"email\":5}")) {
            var request = patch(body); assertThatThrownBy(() -> profiles.patch(authentication, request)).isInstanceOf(ApiException.class);
        }
        verify(users, never()).saveAndFlush(any());
    }

    @Test void socialIdentityChangeDoesNotInheritTrustedVerificationOrInternalNote() throws Exception {
        var old = new User.UserSocialAccount(); old.setPlatform("Line"); old.setHandle("old"); old.setVerified(true); old.setNote("Internal only"); user.setSocialAccounts(List.of(old));
        var same = profiles.patch(authentication, patch("{\"socialAccounts\":[{\"platform\":\"Line\",\"handle\":\"old\"}]}"));
        assertThat(same.socialAccounts().get(0).verified()).isTrue(); assertThat(json.writeValueAsString(same)).doesNotContain("Internal only", "note");
        var changed = profiles.patch(authentication, patch("{\"socialAccounts\":[{\"platform\":\"Line\",\"handle\":\"new\"}]}"));
        assertThat(changed.socialAccounts().get(0).verified()).isFalse(); assertThat(user.getSocialAccounts().get(0).getNote()).isNull();
    }

    @Test void optionalAddressOmissionAndClearAreDistinctAndCoordinatesAreBounded() throws Exception {
        profiles.patch(authentication, patch("{\"defaultAddress\":{\"city\":\"Tokyo\",\"latitude\":35}}"));
        assertThat(profiles.patch(authentication, patch("{\"defaultAddress\":{\"postalCode\":\"100\"}}")).defaultAddress().city()).isEqualTo("Tokyo");
        var bad = patch("{\"defaultAddress\":{\"latitude\":91}}");
        assertThatThrownBy(() -> profiles.patch(authentication, bad)).isInstanceOf(ApiException.class);
        assertThat(profiles.patch(authentication, patch("{\"defaultAddress\":null}")).defaultAddress()).isNull();
        assertThat(profiles.patch(authentication, patch("{\"socialAccounts\":null}")).socialAccounts()).isEmpty();
    }

    @Test void disabledAccountIsRejectedForSelfWhileAdminCanStillLockItForReenable() {
        user.setEnabled(false);
        assertThat(profiles.lock(1L)).isSameAs(user);
        assertThatThrownBy(() -> profiles.lockCurrent(authentication)).isInstanceOf(ApiException.class);
    }

    @Test void databaseUniqueConstraintRaceIsReturnedAsADuplicateRequest() throws Exception {
        when(users.saveAndFlush(user)).thenThrow(new org.springframework.dao.DataIntegrityViolationException("unique email"));
        var request = patch("{\"email\":\"new@example.com\"}");
        assertThatThrownBy(() -> profiles.patch(authentication, request)).isInstanceOf(ApiException.class)
            .hasMessageContaining("error.users.duplicate");
    }
}
