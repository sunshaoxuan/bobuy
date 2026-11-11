package com.bobbuy.api;
import com.bobbuy.api.response.ApiResponse;
import com.bobbuy.service.ProductRatingService;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/storefront/product-reviews")
public class PublicProductReviewController {
 private final ProductRatingService service;
 public PublicProductReviewController(ProductRatingService service){this.service=service;}
 @GetMapping("/{id}") public ApiResponse<?> summary(@PathVariable String id){return ApiResponse.success(service.summary(id));}
 @GetMapping("/{id}/comments") public ApiResponse<?> list(@PathVariable String id,@RequestParam(defaultValue="0") int page){return ApiResponse.success(service.list(id,page));}
}
