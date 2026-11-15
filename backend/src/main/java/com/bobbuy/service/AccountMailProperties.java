package com.bobbuy.service;

import java.net.URI;
import java.time.Duration;
import java.util.Locale;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Non-secret contract for account email and recovery. SMTP credentials are
 * deliberately absent: they may only come from the encrypted mail settings.
 */
@Component
@ConfigurationProperties(prefix = "bobbuy.account-mail")
public class AccountMailProperties implements InitializingBean {
    private boolean deliveryEnabled;
    private String smtpHost = "mail.briconbric.com";
    private int smtpPort = 587;
    private String smtpTlsMode = "STARTTLS";
    private String smtpUsername = "postmaster@bobuy.cc";
    private String fromAddress = "postmaster@bobuy.cc";
    private URI publicBaseUrl = URI.create("https://bobuy.cc");
    private boolean requireVerifiedEmailForCheckout = true;
    private Duration passwordResetLinkTtl = Duration.ofMinutes(30);

    @Override
    public void afterPropertiesSet() {
        if (smtpHost == null || !smtpHost.matches("[A-Za-z0-9][A-Za-z0-9.-]*[A-Za-z0-9]")) invalid();
        if (smtpPort != 465 && smtpPort != 587) invalid();
        smtpTlsMode = smtpTlsMode == null ? "" : smtpTlsMode.toUpperCase(Locale.ROOT);
        if (!(smtpPort == 587 && smtpTlsMode.equals("STARTTLS"))
                && !(smtpPort == 465 && smtpTlsMode.equals("TLS"))) invalid();
        if (!mailbox(smtpUsername) || !mailbox(fromAddress)) invalid();
        if (publicBaseUrl == null || !"https".equalsIgnoreCase(publicBaseUrl.getScheme())
                || publicBaseUrl.getHost() == null || publicBaseUrl.getUserInfo() != null
                || publicBaseUrl.getQuery() != null || publicBaseUrl.getFragment() != null) invalid();
        if (passwordResetLinkTtl == null || passwordResetLinkTtl.compareTo(Duration.ofMinutes(5)) < 0
                || passwordResetLinkTtl.compareTo(Duration.ofHours(24)) > 0) invalid();
    }

    private boolean mailbox(String value) {
        return value != null && value.length() <= 254 && value.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+");
    }

    private void invalid() {
        throw new IllegalStateException("Account mail configuration is invalid");
    }

    public boolean isDeliveryEnabled() { return deliveryEnabled; }
    public void setDeliveryEnabled(boolean value) { deliveryEnabled = value; }
    public String getSmtpHost() { return smtpHost; }
    public void setSmtpHost(String value) { smtpHost = value; }
    public int getSmtpPort() { return smtpPort; }
    public void setSmtpPort(int value) { smtpPort = value; }
    public String getSmtpTlsMode() { return smtpTlsMode; }
    public void setSmtpTlsMode(String value) { smtpTlsMode = value; }
    public String getSmtpUsername() { return smtpUsername; }
    public void setSmtpUsername(String value) { smtpUsername = value; }
    public String getFromAddress() { return fromAddress; }
    public void setFromAddress(String value) { fromAddress = value; }
    public URI getPublicBaseUrl() { return publicBaseUrl; }
    public void setPublicBaseUrl(URI value) { publicBaseUrl = value; }
    public boolean isRequireVerifiedEmailForCheckout() { return requireVerifiedEmailForCheckout; }
    public void setRequireVerifiedEmailForCheckout(boolean value) { requireVerifiedEmailForCheckout = value; }
    public Duration getPasswordResetLinkTtl() { return passwordResetLinkTtl; }
    public void setPasswordResetLinkTtl(Duration value) { passwordResetLinkTtl = value; }
}
