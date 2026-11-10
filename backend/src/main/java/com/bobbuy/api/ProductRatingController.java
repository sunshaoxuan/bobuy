package com.bobbuy.api;
import com.bobbuy.api.response.ApiResponse;
import com.bobbuy.service.ProductRatingService;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/merchant/product-ratings")
public class ProductRatingController {
 private final ProductRatingService service;
 public ProductRatingController(ProductRatingService service){this.service=service;}
 @GetMapping("/{id}") public ApiResponse<?> get(@PathVariable String id){return ApiResponse.success(service.get(id));}
 @PutMapping("/{id}") public ApiResponse<?> save(@PathVariable String id,@RequestBody ProductRatingService.Input input){return ApiResponse.success(service.save(id,input));}
}
