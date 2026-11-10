package com.bobbuy.api.response;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.context.i18n.LocaleContextHolder;

import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {
  private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
  private final MessageSource messageSource;

  public GlobalExceptionHandler(MessageSource messageSource) {
    this.messageSource = messageSource;
  }

  @ExceptionHandler(ApiException.class)
  public ResponseEntity<ApiError> handleApiException(ApiException ex) {
    log.debug("API error: {}", ex.getMessage());
    String rawMessage = messageSource.getMessage(ex.getMessageKey(), ex.getMessageArgs(), null,
        LocaleContextHolder.getLocale());
    String message = (rawMessage != null)
        ? rawMessage
        : (ex.getMessageKey().startsWith("error.")
            ? messageSource.getMessage("error.common.unknown", null, "Unknown error", LocaleContextHolder.getLocale())
            : ex.getMessageKey());
    return ResponseEntity.status(resolveStatus(ex.getErrorCode()))
        .body(new ApiError(ex.getErrorCode().name(), message));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ApiError> handleValidationException(MethodArgumentNotValidException ex) {
    String message = ex.getBindingResult().getFieldErrors().stream()
        .map(error -> {
          String m = messageSource.getMessage(error, LocaleContextHolder.getLocale());
          return m != null ? m : messageSource.getMessage("error.validation.failed", null, LocaleContextHolder.getLocale());
        })
        .collect(Collectors.joining("; "));
    return ResponseEntity.badRequest().body(new ApiError(ErrorCode.INVALID_REQUEST.name(), message));
  }

  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ResponseEntity<ApiError> handleNotReadable(HttpMessageNotReadableException ex) {
    log.warn("HttpMessageNotReadable: {}", ex.getMessage());
    String message = messageSource.getMessage("error.validation.failed", null, LocaleContextHolder.getLocale());
    return ResponseEntity.badRequest().body(new ApiError(ErrorCode.INVALID_REQUEST.name(), message));
  }

  @ExceptionHandler(org.springframework.web.servlet.resource.NoResourceFoundException.class)
  public ResponseEntity<ApiError> handleMissingResource(org.springframework.web.servlet.resource.NoResourceFoundException ex) {
    String message = messageSource.getMessage("error.common.not_found", null, "Resource not found", LocaleContextHolder.getLocale());
    return ResponseEntity.status(404).body(new ApiError(ErrorCode.RESOURCE_NOT_FOUND.name(), message));
  }

  @ExceptionHandler({org.springframework.orm.ObjectOptimisticLockingFailureException.class,jakarta.persistence.OptimisticLockException.class})
  public ResponseEntity<ApiError> handleConcurrentEdit(Exception exception) {
    String message=messageSource.getMessage("sale.conflict",null,LocaleContextHolder.getLocale());
    return ResponseEntity.status(409).body(new ApiError(ErrorCode.INVALID_REQUEST.name(),message));
  }

  @ExceptionHandler(com.bobbuy.service.MediaStorageUnavailableException.class)
  public ResponseEntity<ApiError> handleMediaUnavailable(com.bobbuy.service.MediaStorageUnavailableException exception) {
    String message=messageSource.getMessage("error.internal",null,LocaleContextHolder.getLocale());
    return ResponseEntity.status(503).body(new ApiError("SERVICE_UNAVAILABLE",message));
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ApiError> handleUnexpected(Exception ex) {
    if (log.isDebugEnabled()) {
      log.debug("Unexpected error", ex);
    } else {
      log.warn("Unexpected error: {}", ex.getMessage());
    }
    String message = messageSource.getMessage("error.internal", null, LocaleContextHolder.getLocale());
    return ResponseEntity.internalServerError()
        .body(new ApiError(ErrorCode.INTERNAL_ERROR.name(), message));
  }

  private int resolveStatus(ErrorCode errorCode) {
    return switch (errorCode) {
      case RESOURCE_NOT_FOUND -> 404;
      case UNAUTHORIZED -> 401;
      case FORBIDDEN -> 403;
      case INVALID_REQUEST, INVALID_STATUS -> 400;
      default -> 500;
    };
  }
}
