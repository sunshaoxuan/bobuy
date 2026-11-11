package com.bobbuy.api;
import com.bobbuy.api.response.ApiResponse;
import com.bobbuy.service.ProductRatingService;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/product-reviews")
public class ProductRatingController {
 private final ProductRatingService service;
 public ProductRatingController(ProductRatingService service){this.service=service;}
 @GetMapping("/{id}/mine") public ApiResponse<?> get(@PathVariable String id){return ApiResponse.success(service.get(id));}
 @PutMapping("/{id}/mine") public ApiResponse<?> save(@PathVariable String id,@RequestBody ProductRatingService.Input input){return ApiResponse.success(service.save(id,input));}
}
