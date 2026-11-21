package com.bobbuy.api;

import com.bobbuy.api.response.ApiResponse;
import com.bobbuy.service.ProductCartAvailability;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/merchant/product-cart-availability")
public class ProductCartAvailabilityController {
    private final ProductCartAvailability availability;

    public ProductCartAvailabilityController(ProductCartAvailability availability) {
        this.availability = availability;
    }

    public record Confirm(@NotNull @Pattern(regexp = "[a-f0-9]{64}") String revision) {}

    @GetMapping("/preview")
    public ApiResponse<ProductCartAvailability.Preview> preview() {
        return ApiResponse.success(availability.preview());
    }

    @PostMapping("/enable")
    public ApiResponse<ProductCartAvailability.Result> enable(@Valid @RequestBody Confirm confirm) {
        return ApiResponse.success(availability.enable(confirm.revision()));
    }
}
