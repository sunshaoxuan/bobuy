package com.bobbuy.service;

import java.net.URI;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class AccountMailPropertiesTest {
    @Test void productDefaultsAreNonSecretAndDeliveryIsOff() {
        var properties = new AccountMailProperties();
        properties.afterPropertiesSet();

        assertThat(properties.isDeliveryEnabled()).isFalse();
        assertThat(properties.getSmtpHost()).isEqualTo("mail.briconbric.com");
        assertThat(properties.getFromAddress()).isEqualTo("postmaster@bobuy.cc");
        assertThat(properties.getPublicBaseUrl()).isEqualTo(URI.create("https://bobuy.cc"));
        assertThat(properties.isRequireVerifiedEmailForCheckout()).isTrue();
        assertThat(properties.getPasswordResetLinkTtl()).isEqualTo(Duration.ofMinutes(30));
    }

    @Test void rejectsUnsafeLinkAndTransportConfigurationWithoutEchoingValues() {
        var properties = new AccountMailProperties();
        properties.setPublicBaseUrl(URI.create("http://user@example.test/reset?token=value"));

        assertThatThrownBy(properties::afterPropertiesSet)
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("Account mail configuration is invalid")
            .hasMessageNotContaining("password", "token");
    }

    @Test void enabledDeliveryFailsClosedWithoutProtectedEncryption() {
        var properties = new AccountMailProperties();
        properties.setDeliveryEnabled(true);
        var cipher = mock(MailSecretCipher.class);
        when(cipher.ready()).thenReturn(false);

        assertThatThrownBy(() -> new AccountMailStartupValidator(properties, cipher).afterPropertiesSet())
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("Account mail delivery requires protected encrypted storage");
    }
}
