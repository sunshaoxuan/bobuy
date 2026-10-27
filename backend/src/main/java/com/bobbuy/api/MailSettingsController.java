package com.bobbuy.api;
import com.bobbuy.api.response.*;
import com.bobbuy.service.MailSettingsService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.core.Authentication;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/admin/settings/mail")
public class MailSettingsController {
 private final MailSettingsService service;
 public MailSettingsController(MailSettingsService service) { this.service=service; }
 @GetMapping public ApiResponse<MailSettingsService.View> get() { return ApiResponse.success(service.view()); }
 @PutMapping public ApiResponse<MailSettingsService.View> save(@Valid @RequestBody MailSettingsService.Edit edit,Authentication authentication) {
  return ApiResponse.success(service.save(edit,authentication));
 }
 public record Test(@NotBlank @Email @Size(max=254) String recipient) {}
 @PostMapping("/test") public ApiResponse<String> test(@Valid @RequestBody Test request,Authentication authentication) {
  service.test(request.recipient(),authentication); return ApiResponse.success("SENT");
 }
 // Never pass request parsing, validation, transport or encryption exceptions to a logger
 // which could include submitted JSON, a password, an AUTH transcript or token.
 @ExceptionHandler(Exception.class) public ResponseEntity<ApiError> safeError(Exception error) {
  String message=error instanceof ApiException a?a.getMessageKey():"Mail settings could not be processed";
  return ResponseEntity.badRequest().body(new ApiError("INVALID_REQUEST",message));
 }
}
