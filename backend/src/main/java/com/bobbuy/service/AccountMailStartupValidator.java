package com.bobbuy.service;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.stereotype.Component;

/** Fail closed before account delivery can use a plaintext or unavailable secret source. */
@Component
public class AccountMailStartupValidator implements InitializingBean {
    private final AccountMailProperties properties;
    private final MailSecretCipher cipher;

    public AccountMailStartupValidator(AccountMailProperties properties, MailSecretCipher cipher) {
        this.properties = properties;
        this.cipher = cipher;
    }

    @Override
    public void afterPropertiesSet() {
        if (properties.isDeliveryEnabled() && !cipher.ready()) {
            throw new IllegalStateException("Account mail delivery requires protected encrypted storage");
        }
    }
}
