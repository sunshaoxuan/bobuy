package com.bobbuy.service;

/** Technical actor budget, independent of semantic AI decisions. No counts or private contents leak. */
public class CostcoOnboardingQuotaException extends RuntimeException {
    private final int retryAfterSeconds;
    public CostcoOnboardingQuotaException(String code,int retryAfterSeconds){super(code);this.retryAfterSeconds=retryAfterSeconds;}
    public int retryAfterSeconds(){return retryAfterSeconds;}
}
