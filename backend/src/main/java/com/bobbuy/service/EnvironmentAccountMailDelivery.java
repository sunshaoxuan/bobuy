package com.bobbuy.service;

import com.bobbuy.model.MailSettings;
import java.util.Locale;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.stereotype.Component;

/** SMTP delivery whose credential can only enter through the protected runtime environment. */
@Component
public class EnvironmentAccountMailDelivery {
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
        if (!ready()) throw new SmtpDelivery.DeliveryException(SmtpDelivery.FailureCategory.AUTHENTICATION);
        MailSettings settings = new MailSettings();
        settings.host = properties.getSmtpHost();
        settings.port = properties.getSmtpPort();
        settings.tlsMode = properties.getSmtpTlsMode().toUpperCase(Locale.ROOT);
        settings.username = properties.getSmtpUsername();
        settings.fromAddress = properties.getFromAddress();
        settings.replyTo = properties.getFromAddress();
        smtp.send(settings, password, message);
    }
}
