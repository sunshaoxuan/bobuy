package com.bobbuy.api;
import com.bobbuy.api.response.ApiResponse;
import com.bobbuy.service.ProductPopularityService;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/storefront/product-popularity")
public class ProductPopularityController {
 private final ProductPopularityService service;
 public ProductPopularityController(ProductPopularityService service){this.service=service;}
 @GetMapping("/{id}") public ApiResponse<?> get(@PathVariable String id){return ApiResponse.success(service.get(id));}
 @PostMapping("/{id}/click") public ApiResponse<?> click(@PathVariable String id){return ApiResponse.success(service.click(id));}
}
