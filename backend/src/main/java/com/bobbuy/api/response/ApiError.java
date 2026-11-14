package com.bobbuy.api.response;

public class ApiError {
  private final String status;
  private final String errorCode;
  private final String message;
  private final java.util.List<PublicationCondition> conditions;

  public ApiError(String errorCode, String message) {
    this(errorCode,message,java.util.List.of());
  }

  public ApiError(String errorCode, String message, java.util.List<PublicationCondition> conditions) {
    this.status = "error";
    this.errorCode = errorCode;
    this.message = message;
    this.conditions = java.util.List.copyOf(conditions);
  }

  public String getStatus() {
    return status;
  }

  public String getErrorCode() {
    return errorCode;
  }

  public String getMessage() {
    return message;
  }
  public java.util.List<PublicationCondition> getConditions(){return conditions;}
}
