package com.bobbuy.service;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import com.bobbuy.repository.PasswordResetTokenRepository;

@Component
public class PasswordResetMailListener {
    private final MailSettingsService mail;
    private final PasswordResetTokenRepository tokens;

    public PasswordResetMailListener(MailSettingsService mail, PasswordResetTokenRepository tokens) {
        this.mail = mail; this.tokens = tokens;
    }

    @Async
    @Transactional
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void deliver(PasswordResetService.PasswordResetMailRequested request) {
        try {
            if (!mail.sendIfConfigured(request.message())) tokens.deleteByTokenHash(request.tokenHash());
        } catch (RuntimeException unavailable) {
            tokens.deleteByTokenHash(request.tokenHash());
        }
    }
}
