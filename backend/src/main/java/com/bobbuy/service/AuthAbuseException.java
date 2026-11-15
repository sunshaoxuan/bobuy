package com.bobbuy.service;

/** A stable, secret-free signal translated to HTTP 429 by the API boundary. */
public final class AuthAbuseException extends RuntimeException {
    private final long retryAfterSeconds;

    public AuthAbuseException(long retryAfterSeconds) {
        super("Authentication request throttled");
        this.retryAfterSeconds = Math.max(1, retryAfterSeconds);
    }

    public long retryAfterSeconds() { return retryAfterSeconds; }
}

