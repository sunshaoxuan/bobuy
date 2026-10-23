package com.bobbuy.api;

import com.bobbuy.api.response.ApiResponse;
import com.bobbuy.service.UserManagementService;
import com.bobbuy.service.UserManagementService.Account;
import com.bobbuy.service.UserManagementService.Edit;
import jakarta.validation.Valid;
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
    @PutMapping("/{id}") public ApiResponse<Account> update(@PathVariable Long id, @Valid @RequestBody Edit request,
            Authentication authentication) { return ApiResponse.success(users.update(id, request, authentication)); }
}
