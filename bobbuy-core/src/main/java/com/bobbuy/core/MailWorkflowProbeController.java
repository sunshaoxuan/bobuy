package com.bobbuy.core;

import com.bobbuy.security.InternalServiceIdentity;
import com.bobbuy.service.MailSettingsService;
import com.bobbuy.service.MailSettingsService.TestOutcome;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
class MailWorkflowProbeController {
    private final MailSettingsService mail;

    MailWorkflowProbeController(MailSettingsService mail) {
        this.mail = mail;
    }

    @PostMapping(path = "/internal/account-mail/workflow-test", produces = MediaType.TEXT_PLAIN_VALUE)
    ResponseEntity<String> send(HttpServletRequest request) {
        if (!"127.0.0.1".equals(request.getRemoteAddr()) || InternalServiceIdentity.from(request)
                .filter(identity -> "mail-workflow-probe".equals(identity.serviceName())).isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        TestOutcome outcome;
        try {
            outcome = mail.testFromWorkflow();
        } catch (RuntimeException failure) {
            outcome = TestOutcome.SETTINGS;
        }
        return ResponseEntity.ok(outcome.name());
    }
}
