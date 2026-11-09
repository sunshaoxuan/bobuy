package com.bobbuy.api;

import com.bobbuy.api.response.ApiResponse;
import com.bobbuy.service.CustomerOrderAmendmentService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/customer/orders/{orderId}/amendment")
public class CustomerOrderAmendmentController {
    private final CustomerOrderAmendmentService service;
    public CustomerOrderAmendmentController(CustomerOrderAmendmentService service) { this.service = service; }
    @GetMapping public ApiResponse<CustomerOrderAmendmentView> preview(@PathVariable Long orderId, Authentication authentication) {
        return ApiResponse.success(service.preview(authentication,orderId));
    }
    @PatchMapping public ApiResponse<CustomerOrderAmendmentView> amend(@PathVariable Long orderId,
            @RequestBody CustomerOrderAmendmentRequest request, Authentication authentication) {
        return ApiResponse.success(service.amend(authentication,orderId,request));
    }
}
