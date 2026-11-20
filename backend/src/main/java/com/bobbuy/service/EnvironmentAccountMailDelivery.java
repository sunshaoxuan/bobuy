package com.bobbuy.service;

import com.bobbuy.model.MailSettings;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.stereotype.Component;

/** SMTP delivery whose credential can only enter through the protected runtime environment. */
@Component
public class EnvironmentAccountMailDelivery {
    private static final String TEST_MAILBOX = "postmaster@bobuy.cc";
    private final AccountMailProperties properties;
    private final SmtpDelivery smtp;
    private final String password;

    public EnvironmentAccountMailDelivery(AccountMailProperties properties, SmtpDelivery smtp,
            @Value("${bobbuy.account-mail.smtp-password:}") String password) {
        this.properties = properties;
        this.smtp = smtp;
        this.password = password;
    }

    public boolean ready() { return password != null && !password.isBlank(); }

    public void send(SimpleMailMessage message) {
        send(message, properties.getFromAddress());
    }

    public void sendControlledTest() {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(TEST_MAILBOX);
        message.setSubject("Bobuy production SMTP test");
        message.setText("Bobuy production mail delivery test. No account data or token is included.");
        send(message, TEST_MAILBOX);
    }

    private void send(SimpleMailMessage message, String fromAddress) {
        if (!ready()) throw new SmtpDelivery.DeliveryException(SmtpDelivery.FailureCategory.AUTHENTICATION);
        MailSettings settings = new MailSettings();
        settings.host = properties.getSmtpHost();
        settings.port = properties.getSmtpPort();
        settings.tlsMode = properties.getSmtpTlsMode().toUpperCase(Locale.ROOT);
        settings.username = properties.getSmtpUsername();
        settings.fromAddress = fromAddress;
        settings.replyTo = fromAddress;
        smtp.send(settings, password, message);
    }
}
