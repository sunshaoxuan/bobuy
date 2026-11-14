package com.bobbuy.service;

import java.util.List;

public final class PublicationValidationException extends RuntimeException {
    public record Failure(String code,String messageKey,String target) {}
    private final List<Failure> failures;
    public PublicationValidationException(List<Failure> failures){super("recommendation.publication.validation");this.failures=List.copyOf(failures);}
    public List<Failure> failures(){return failures;}
}
