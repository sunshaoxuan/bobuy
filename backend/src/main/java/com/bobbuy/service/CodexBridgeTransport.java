package com.bobbuy.service;

import java.time.Duration;
import java.util.List;

/** Mockable boundary: unit tests never need to contact the production Bridge. */
public interface CodexBridgeTransport {
    record Reply(String content, String model) {}
    final class Failure extends RuntimeException {
        private final boolean quota;
        public Failure(boolean quota) { super("bridge_request_failed"); this.quota = quota; }
        public boolean quota() { return quota; }
    }
    Reply complete(String model, String prompt, List<String> images, Duration timeout);
}
