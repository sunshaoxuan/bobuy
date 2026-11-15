package com.bobbuy.service;

import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = "bobbuy.account-mail.password-reset-enabled=false")
class PasswordResetDisabledStartupTest {
    @Autowired PasswordResetMailListener listener;

    @Test
    void applicationStartsWithPasswordResetDisabled() {
        assertNotNull(listener);
    }
}
