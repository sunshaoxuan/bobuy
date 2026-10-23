package com.bobbuy.service;

import com.bobbuy.api.response.ApiException;
import com.bobbuy.api.response.ErrorCode;
import com.bobbuy.model.CheckoutIdentity;
import com.bobbuy.model.Role;
import com.bobbuy.model.User;
import com.bobbuy.repository.CheckoutIdentityRepository;
import com.bobbuy.repository.EmailChallengeRepository;
import com.bobbuy.repository.UserRepository;
import jakarta.validation.constraints.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserManagementService {
    private final UserRepository users;
    private final CheckoutIdentityRepository identities;
    private final EmailChallengeRepository challenges;
    private final PasswordEncoder passwords;
    private final AuthService auth;

    public UserManagementService(UserRepository users, CheckoutIdentityRepository identities,
            EmailChallengeRepository challenges, PasswordEncoder passwords, AuthService auth) {
        this.users = users; this.identities = identities; this.challenges = challenges;
        this.passwords = passwords; this.auth = auth;
    }

    public List<Account> list() {
        return users.findAll().stream().sorted(Comparator.comparing(User::getId).reversed()).map(this::account).toList();
    }

    @Transactional
    public Account create(Edit request) {
        validate(request, null);
        User user = new User();
        user.setId(identities.saveAndFlush(new CheckoutIdentity()).id);
        apply(user, request);
        return account(users.saveAndFlush(user));
    }

    @Transactional
    public Account update(Long id, Edit request, Authentication authentication) {
        User user = users.lockById(id).orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND, "error.user.not_found"));
        validate(request, user);
        if (!request.enabled() && auth.currentUser(authentication).id().equals(id)) throw invalid("error.users.self_disable");
        apply(user, request);
        return account(users.saveAndFlush(user));
    }

    private void validate(Edit request, User existing) {
        String username = request.username().toLowerCase(Locale.ROOT);
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        boolean conflict = users.findAll().stream().filter(u -> existing == null || !u.getId().equals(existing.getId()))
            .anyMatch(u -> username.equalsIgnoreCase(u.getUsername()) || email.equalsIgnoreCase(u.getEmail()));
        if (conflict) throw invalid("error.users.duplicate");
        String password = request.password();
        if (existing == null || (password != null && !password.isEmpty())) {
            if (password == null || password.length() < 8 || password.getBytes(StandardCharsets.UTF_8).length > 72)
                throw invalid("error.users.password");
        }
    }

    private void apply(User user, Edit request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        if (!Objects.equals(user.getEmail(), email)) {
            user.setEmailVerifiedAt(null);
            challenges.findById(user.getId()).ifPresent(challenges::delete);
        }
        user.setUsername(request.username().toLowerCase(Locale.ROOT));
        user.setName(request.name().trim()); user.setEmail(email);
        user.setRoles(request.roles()); user.setEnabled(request.enabled());
        if (request.password() != null && !request.password().isEmpty()) user.setPasswordHash(passwords.encode(request.password()));
    }

    private Account account(User user) {
        return new Account(user.getId(), user.getUsername(), user.getName(), user.getEmail(), user.getRoles(),
            user.isEnabled(), user.isPlatformAdmin(), user.getEmailVerifiedAt() != null);
    }

    private ApiException invalid(String key) { return new ApiException(ErrorCode.INVALID_REQUEST, key); }

    public record Edit(@NotBlank @Pattern(regexp = "[a-zA-Z0-9_]{3,40}") String username,
        @NotBlank @Size(max = 100) String name, @NotBlank @Email @Size(max = 254) String email,
        @Size(max = 72) String password, @NotEmpty Set<@NotNull Role> roles, @NotNull Boolean enabled) {}

    public record Account(Long id, String username, String name, String email, Set<Role> roles,
        boolean enabled, boolean platformAdmin, boolean emailVerified) {}
}
