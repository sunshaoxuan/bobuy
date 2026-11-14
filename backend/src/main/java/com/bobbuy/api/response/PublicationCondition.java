package com.bobbuy.api.response;

/** A stable, actionable reason why one recommendation item cannot be published. */
public record PublicationCondition(String code,String message,String target) {}
