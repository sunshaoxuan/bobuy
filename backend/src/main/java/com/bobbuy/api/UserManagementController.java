package com.bobbuy.api;

import com.bobbuy.api.response.ApiResponse;
import com.bobbuy.service.UserManagementService;
import com.bobbuy.service.UserManagementService.Account;
import com.bobbuy.service.UserManagementService.Edit;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/users")
public class UserManagementController {
    private final UserManagementService users;
    public UserManagementController(UserManagementService users) { this.users = users; }
    @GetMapping public ApiResponse<List<Account>> list() { return ApiResponse.success(users.list()); }
    @PostMapping public ApiResponse<Account> create(@Valid @RequestBody Edit request) { return ApiResponse.success(users.create(request)); }
    @DeleteMapping("/{id}/registration-test")
    public ApiResponse<Boolean> cleanupRegistrationTest(@PathVariable Long id,
            @Valid @RequestBody CleanupIdentity identity, Authentication authentication) {
        users.deleteRegistrationTest(id, identity.username(), identity.email(), authentication);
        return ApiResponse.success(true);
    }
    public record CleanupIdentity(@NotBlank @Size(max = 40) String username,
            @NotBlank @Email @Size(max = 254) String email) {}

    @PutMapping("/{id}") public ApiResponse<Account> update(@PathVariable Long id, @Valid @RequestBody Edit request,
            Authentication authentication) { return ApiResponse.success(users.update(id, request, authentication)); }
}
