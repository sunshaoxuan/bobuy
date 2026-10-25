package com.bobbuy.api.response;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.context.MessageSource;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;

import java.util.List;
import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;

class GlobalExceptionHandlerTest {
  private MessageSource messageSource;
  private GlobalExceptionHandler handler;

  @BeforeEach
  void setUp() {
    messageSource = Mockito.mock(MessageSource.class);
    handler = new GlobalExceptionHandler(messageSource);
  }

  @Test
  void handlesApiException() {
    ApiException ex = new ApiException(ErrorCode.RESOURCE_NOT_FOUND, "error.test");
    Mockito.when(messageSource.getMessage(eq("error.test"), any(), any(), any(Locale.class)))
        .thenReturn("Not Found Message");

    ResponseEntity<ApiError> response = handler.handleApiException(ex);
    assertThat(response.getStatusCode().value()).isEqualTo(404);
    assertThat(response.getBody().getMessage()).isEqualTo("Not Found Message");
  }

  @Test
  void handlesValidationException() {
    MethodArgumentNotValidException ex = Mockito.mock(MethodArgumentNotValidException.class);
    BindingResult bindingResult = Mockito.mock(BindingResult.class);
    FieldError fieldError = new FieldError("object", "field", "message");
    
    Mockito.when(ex.getBindingResult()).thenReturn(bindingResult);
    Mockito.when(bindingResult.getFieldErrors()).thenReturn(List.of(fieldError));
    Mockito.when(messageSource.getMessage(eq(fieldError), any(Locale.class))).thenReturn("Validation Error");

    ResponseEntity<ApiError> response = handler.handleValidationException(ex);
    assertThat(response.getStatusCode().value()).isEqualTo(400);
    assertThat(response.getBody().getMessage()).isEqualTo("Validation Error");
  }

  @Test
  void handlesUnexpectedException() {
    Exception ex = new RuntimeException("Unexpected");
    Mockito.when(messageSource.getMessage(eq("error.internal"), any(), any(Locale.class))).thenReturn("Internal Error");

    ResponseEntity<ApiError> response = handler.handleUnexpected(ex);
    assertThat(response.getStatusCode().value()).isEqualTo(500);
    assertThat(response.getBody().getMessage()).isEqualTo("Internal Error");
  }

  @Test
  void resolveStatusMappings() {
    assertThat(handler.handleApiException(new ApiException(ErrorCode.INVALID_STATUS, "k")).getStatusCode().value()).isEqualTo(400);
    assertThat(handler.handleApiException(new ApiException(ErrorCode.INTERNAL_ERROR, "k")).getStatusCode().value()).isEqualTo(500);
  }
}
