package com.bobbuy.api;

import com.bobbuy.service.MailSettingsService;
import com.bobbuy.service.SmtpDelivery;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Loopback-only operator probe. It deliberately ignores all customer mail feature flags. */
@RestController
@RequestMapping("/internal/account-mail")
public class ControlledMailTestController {
    private final MailSettingsService mail;
    public ControlledMailTestController(MailSettingsService mail) { this.mail = mail; }

    @PostMapping("/test")
    public ResponseEntity<Map<String,String>> send(HttpServletRequest request) {
        if (!request.getRemoteAddr().equals("127.0.0.1") && !request.getRemoteAddr().equals("0:0:0:0:0:0:0:1"))
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        try {
            mail.sendControlledTest();
            return ResponseEntity.ok(Map.of("status", "success"));
        } catch (SmtpDelivery.DeliveryException failure) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(Map.of("status", "failed", "category", failure.category().name().toLowerCase(java.util.Locale.ROOT)));
        } catch (RuntimeException failure) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(Map.of("status", "failed", "category", "unknown"));
        }
    }
}
