package com.bobbuy.api;
import com.bobbuy.service.ProductPricingService;
import com.bobbuy.api.response.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/merchant/product-pricing/{productId}")
public class ProductPricingController {
 private final ProductPricingService service;
 public ProductPricingController(ProductPricingService service){this.service=service;}
 @GetMapping public ApiResponse<?> get(@PathVariable String productId){return ApiResponse.success(service.get(productId));}
 @PostMapping("/adjustments") public ApiResponse<?> create(@PathVariable String productId,@Valid @RequestBody ProductPricingService.Input input){return ApiResponse.success(service.draft(productId,null,input));}
 @PutMapping("/adjustments/{id}") public ApiResponse<?> edit(@PathVariable String productId,@PathVariable Long id,@Valid @RequestBody ProductPricingService.Input input){return ApiResponse.success(service.draft(productId,id,input));}
 @PostMapping("/adjustments/{id}/approve") public ApiResponse<?> approve(@PathVariable String productId,@PathVariable Long id,@Valid @RequestBody ProductPricingService.Action input){return ApiResponse.success(service.approve(productId,id,input));}
 @PostMapping("/adjustments/{id}/cancel") public ApiResponse<?> cancel(@PathVariable String productId,@PathVariable Long id,@Valid @RequestBody ProductPricingService.Action input){return ApiResponse.success(service.cancel(productId,id,input));}
 @PutMapping("/regular") public ApiResponse<?> regular(@PathVariable String productId,@Valid @RequestBody ProductPricingService.Regular input){return ApiResponse.success(service.regular(productId,input));}
}
