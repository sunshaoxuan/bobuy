package com.bobbuy.api;

import com.bobbuy.api.response.ApiError;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Preserve actionable validation/conflict responses at the category HTTP boundary. */
@Order(-1)
@RestControllerAdvice(assignableTypes = {CategoryTreeController.class, CategoryPathImportController.class})
public class CategoryImportExceptionHandler {
  @ExceptionHandler(java.util.NoSuchElementException.class)
  public ResponseEntity<ApiError> missing(java.util.NoSuchElementException error) {
    return ResponseEntity.status(404).body(new ApiError("RESOURCE_NOT_FOUND", "Import not found"));
  }

  @ExceptionHandler(IllegalArgumentException.class)
  public ResponseEntity<ApiError> invalid(IllegalArgumentException error) {
    return ResponseEntity.badRequest().body(new ApiError("INVALID_REQUEST", error.getMessage()));
  }

  @ExceptionHandler(com.bobbuy.service.CategoryImportConflict.class)
  public ResponseEntity<ApiError> conflict(com.bobbuy.service.CategoryImportConflict error) {
    return ResponseEntity.status(409).body(new ApiError("INVALID_STATUS", error.getMessage()));
  }
}
