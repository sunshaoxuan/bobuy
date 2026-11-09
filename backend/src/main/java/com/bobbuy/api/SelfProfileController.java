package com.bobbuy.api;

import com.bobbuy.api.response.ApiResponse;
import com.bobbuy.service.SelfProfileService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth/profile")
public class SelfProfileController {
    private final SelfProfileService profiles;
    public SelfProfileController(SelfProfileService profiles) { this.profiles = profiles; }

    @GetMapping
    public ApiResponse<SelfProfileService.Profile> get(Authentication authentication) {
        return ApiResponse.success(profiles.get(authentication));
    }

    @PatchMapping
    public ApiResponse<SelfProfileService.Profile> patch(Authentication authentication, @RequestBody SelfProfileService.Patch request) {
        return ApiResponse.success(profiles.patch(authentication, request));
    }
}
