package com.bobbuy.service;

import com.bobbuy.api.response.ApiException;
import com.bobbuy.api.response.ErrorCode;
import com.bobbuy.model.User;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Eligibility may only originate in public registration for an operator-configured exact identity. */
@Component
class RegistrationCleanup {
    private final JdbcTemplate db;
    private final Set<String> testAccounts;

    RegistrationCleanup(JdbcTemplate db, @Value("${BOBBUY_REGISTRATION_CLEANUP_ACCOUNTS:}") String accounts) {
        this.db = db;
        this.testAccounts = Arrays.stream(accounts.split(","))
            .map(String::strip)
            .filter(value -> !value.isEmpty())
            .map(value -> value.toLowerCase(Locale.ROOT))
            .collect(Collectors.toUnmodifiableSet());
    }

    void markNewRegistration(User user) {
        if (isConfigured(user.getUsername(), user.getEmail())) {
            db.update("INSERT INTO bb_registration_test_account (user_id, username, email) VALUES (?, ?, ?)",
                user.getId(), user.getUsername(), user.getEmail());
        }
    }

    void revoke(Long id) {
        db.update("DELETE FROM bb_registration_test_account WHERE user_id = ?", id);
    }

    // Caller holds the user row lock used by checkout, verification and session issuance.
    void delete(User user) {
        Long id = user.getId();
        if (!isConfigured(user.getUsername(), user.getEmail()) || !Boolean.TRUE.equals(db.queryForObject("""
                SELECT EXISTS (SELECT 1 FROM bb_registration_test_account
                               WHERE user_id = ? AND username = ? AND email = ?)
                """, Boolean.class, id, user.getUsername(), user.getEmail()))) {
            throw ineligible();
        }
        if (Boolean.TRUE.equals(db.queryForObject("""
                SELECT EXISTS (SELECT 1 FROM bb_order_header WHERE customer_id = ?)
                    OR EXISTS (SELECT 1 FROM bb_customer_order_amendment WHERE customer_id = ?)
                    OR EXISTS (SELECT 1 FROM bb_customer_payment_ledger WHERE customer_id = ?)
                    OR EXISTS (SELECT 1 FROM bb_product_review WHERE user_id = ?)
                    OR EXISTS (SELECT 1 FROM bb_merchant_customer WHERE customer_id = ?)
                    OR EXISTS (SELECT 1 FROM bb_chat_message
                               WHERE sender_id IN (?, ?) OR recipient_id IN (?, ?))
                """, Boolean.class, id, id, id, id, id,
                id.toString(), user.getUsername(), id.toString(), user.getUsername()))) {
            throw ineligible();
        }
        // The user foreign keys protect order, payment, merchant and review records.
        // An FK violation rolls back these auth-artifact deletions as well.
        try {
            db.update("DELETE FROM bb_email_challenge WHERE user_id = ?", id);
            db.update("DELETE FROM bb_refresh_token_session WHERE user_id = ?", id);
            db.update("DELETE FROM bb_password_reset_token WHERE user_id = ?", id);
            revoke(id);
            db.update("DELETE FROM bb_user WHERE id = ?", id);
            db.update("DELETE FROM bb_checkout_identity WHERE id = ?", id);
        } catch (DataIntegrityViolationException hasDependencies) {
            throw ineligible();
        }
    }

    boolean isConfigured(String username, String email) {
        return testAccounts.contains(username + "=" + email);
    }

    private ApiException ineligible() {
        return new ApiException(ErrorCode.INVALID_REQUEST, "error.users.cleanup_ineligible");
    }
}
