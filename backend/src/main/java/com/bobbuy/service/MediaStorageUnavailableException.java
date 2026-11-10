package com.bobbuy.service;

/** Deliberately excludes external SDK exception text, object keys and credentials. */
public final class MediaStorageUnavailableException extends org.springframework.web.server.ResponseStatusException {
 public MediaStorageUnavailableException(){super(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,"Image storage unavailable");}
}
