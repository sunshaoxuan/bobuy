package com.bobbuy.service;

import com.bobbuy.api.response.ApiException;
import com.bobbuy.api.response.ErrorCode;
import com.bobbuy.model.User;
import com.bobbuy.repository.EmailChallengeRepository;
import com.bobbuy.repository.UserRepository;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;
import jakarta.validation.Validator;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The self-service boundary deliberately never binds or serializes User. */
@Service
public class SelfProfileService {
    private final UserRepository users;
    private final EmailChallengeRepository challenges;
    private final AuthService auth;
    private final Validator validator;
    @PersistenceContext private EntityManager entityManager;

    public SelfProfileService(UserRepository users, EmailChallengeRepository challenges, AuthService auth, Validator validator) {
        this.users = users; this.challenges = challenges; this.auth = auth; this.validator = validator;
    }

    @Transactional(readOnly = true)
    public Profile get(Authentication authentication) {
        User user = users.findById(auth.currentUser(authentication).id()).orElseThrow();
        entityManager.refresh(user);
        requireEnabled(user);
        return profile(user);
    }

    @Transactional
    public Profile patch(Authentication authentication, Patch request) {
        User user = lockCurrent(authentication);
        JsonNode fields = request.fields();
        if (fields.has("name")) user.setName(text(fields.get("name"), 100, true));
        if (fields.has("email")) {
            String email = text(fields.get("email"), 254, true).toLowerCase(Locale.ROOT);
            if (!validator.validate(new EmailValue(email)).isEmpty()) throw invalid();
            if (!email.equalsIgnoreCase(Objects.toString(user.getEmail(), "").trim())) {
                if (users.existsByEmailIgnoreCase(email)) throw duplicate();
                user.setEmailVerifiedAt(null);
                invalidateChallenge(challenges, user.getId());
            }
            user.setEmail(email);
        }
        if (fields.has("phone")) user.setPhone(text(fields.get("phone"), 50, false));
        if (fields.has("defaultAddress")) user.setDefaultAddress(address(fields.get("defaultAddress"), user.getDefaultAddress()));
        if (fields.has("socialAccounts")) user.setSocialAccounts(social(fields.get("socialAccounts"), user.getSocialAccounts()));
        try { users.saveAndFlush(user); }
        catch (DataIntegrityViolationException conflict) {
            // The existing lower(email) unique index also arbitrates concurrent claims.
            if (fields.has("email")) throw duplicate();
            throw conflict;
        }
        return profile(user);
    }

    User lockCurrent(Authentication authentication) {
        User user = lock(auth.currentUser(authentication).id());
        requireEnabled(user);
        return user;
    }

    User lock(Long id) {
        User user = users.lockById(id).orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND, "error.user.not_found"));
        // Authentication may already have attached an older User to this persistence context.
        entityManager.refresh(user, LockModeType.PESSIMISTIC_WRITE);
        return user;
    }

    static void invalidateChallenge(EmailChallengeRepository challenges, Long id) {
        challenges.findById(id).ifPresent(challenge -> {
            challenge.expiresAt = Instant.EPOCH;
            challenge.attempts = 5;
            // Keep sentAt: changing email must not reset the resend throttle.
            challenges.save(challenge);
        });
    }

    private static void requireEnabled(User user) {
        if (!user.isEnabled()) throw new ApiException(ErrorCode.UNAUTHORIZED, "error.auth.user_disabled");
    }

    private static User.UserAddress address(JsonNode value, User.UserAddress prior) {
        if (value.isNull()) return null;
        allow(value, Set.of("contactName", "phone", "countryRegion", "city", "addressLine", "postalCode", "latitude", "longitude"));
        User.UserAddress result = new User.UserAddress();
        // Nested omission is also preservation. An explicit null clears the whole address.
        result.setContactName(value.has("contactName") ? text(value.get("contactName"), 100, false) : prior == null ? null : prior.getContactName());
        result.setPhone(value.has("phone") ? text(value.get("phone"), 50, false) : prior == null ? null : prior.getPhone());
        result.setCountryRegion(value.has("countryRegion") ? text(value.get("countryRegion"), 100, false) : prior == null ? null : prior.getCountryRegion());
        result.setCity(value.has("city") ? text(value.get("city"), 100, false) : prior == null ? null : prior.getCity());
        result.setAddressLine(value.has("addressLine") ? text(value.get("addressLine"), 1000, false) : prior == null ? null : prior.getAddressLine());
        result.setPostalCode(value.has("postalCode") ? text(value.get("postalCode"), 30, false) : prior == null ? null : prior.getPostalCode());
        result.setLatitude(value.has("latitude") ? coordinate(value.get("latitude"), 90) : prior == null ? null : prior.getLatitude());
        result.setLongitude(value.has("longitude") ? coordinate(value.get("longitude"), 180) : prior == null ? null : prior.getLongitude());
        return result;
    }

    private static List<User.UserSocialAccount> social(JsonNode value, List<User.UserSocialAccount> prior) {
        if (value.isNull()) return List.of();
        if (!value.isArray() || value.size() > 10) throw invalid();
        Set<List<String>> seen = new HashSet<>();
        List<User.UserSocialAccount> result = new ArrayList<>();
        for (JsonNode entry : value) {
            allow(entry, Set.of("platform", "handle", "displayName"));
            String platform = text(entry.get("platform"), 50, true), handle = text(entry.get("handle"), 200, true);
            if (!seen.add(List.of(platform, handle))) throw invalid();
            User.UserSocialAccount account = new User.UserSocialAccount();
            account.setPlatform(platform); account.setHandle(handle);
            account.setDisplayName(text(entry.get("displayName"), 100, false));
            if (prior != null) prior.stream().filter(old -> platform.equals(old.getPlatform()) && handle.equals(old.getHandle()))
                .findFirst().ifPresent(old -> { account.setVerified(old.isVerified()); account.setNote(old.getNote()); });
            result.add(account);
        }
        return result;
    }

    private static Double coordinate(JsonNode value, int limit) {
        if (value.isNull()) return null;
        if (!value.isNumber() || !Double.isFinite(value.doubleValue()) || Math.abs(value.doubleValue()) > limit) throw invalid();
        return value.doubleValue();
    }

    private static String text(JsonNode value, int max, boolean required) {
        if (value == null || value.isNull()) { if (required) throw invalid(); return null; }
        if (!value.isTextual()) throw invalid();
        String text = value.textValue().trim();
        if (text.length() > max || (required && text.isEmpty())) throw invalid();
        return text.isEmpty() ? null : text;
    }

    private static void allow(JsonNode fields, Set<String> names) {
        if (fields == null || !fields.isObject()) throw invalid();
        fields.fieldNames().forEachRemaining(name -> { if (!names.contains(name)) throw invalid(); });
    }

    private static Profile profile(User user) {
        var a = user.getDefaultAddress();
        Address address = a == null ? null : new Address(a.getContactName(), a.getPhone(), a.getCountryRegion(), a.getCity(), a.getAddressLine(), a.getPostalCode(), a.getLatitude(), a.getLongitude());
        List<Social> social = user.getSocialAccounts() == null ? List.of() : user.getSocialAccounts().stream()
            .map(s -> new Social(s.getPlatform(), s.getHandle(), s.getDisplayName(), s.isVerified())).toList();
        return new Profile(user.getId(), user.getUsername(), user.getName(), user.getEmail(), user.getEmailVerifiedAt() != null, user.getPhone(), address, social);
    }

    public record Patch(JsonNode fields) {
        @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
        public Patch {
            allow(fields, Set.of("name", "email", "phone", "defaultAddress", "socialAccounts"));
            fields = fields.deepCopy();
        }
    }
    private record EmailValue(@NotBlank @Email @Size(max = 254) String email) {}
    public record Profile(Long id, String username, String name, String email, boolean emailVerified, String phone, Address defaultAddress, List<Social> socialAccounts) {}
    public record Address(String contactName, String phone, String countryRegion, String city, String addressLine, String postalCode, Double latitude, Double longitude) {}
    public record Social(String platform, String handle, String displayName, boolean verified) {}
    private static ApiException invalid() { return new ApiException(ErrorCode.INVALID_REQUEST, "error.validation.failed"); }
    private static ApiException duplicate() { return new ApiException(ErrorCode.INVALID_REQUEST, "error.users.duplicate"); }
}
