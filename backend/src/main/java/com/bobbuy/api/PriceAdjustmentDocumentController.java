package com.bobbuy.api;
import com.bobbuy.api.response.ApiResponse;
import com.bobbuy.service.ProductPricingService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/merchant/price-adjustments")
public class PriceAdjustmentDocumentController {
 private final ProductPricingService service;
 public PriceAdjustmentDocumentController(ProductPricingService s){service=s;}
 @GetMapping public ApiResponse<?> list(){return ApiResponse.success(service.documents());}
 @GetMapping("/products") public ApiResponse<?> products(){return ApiResponse.success(service.documentProducts());}
 @PostMapping public ApiResponse<?> create(@Valid @RequestBody ProductPricingService.DocumentInput i){return ApiResponse.success(service.saveDocument(null,i));}
 @PutMapping("/{id}") public ApiResponse<?> edit(@PathVariable Long id,@Valid @RequestBody ProductPricingService.DocumentInput i){return ApiResponse.success(service.saveDocument(id,i));}
 @PostMapping("/{id}/approve") public ApiResponse<?> approve(@PathVariable Long id,@Valid @RequestBody ProductPricingService.Action a){return ApiResponse.success(service.act(id,a,true));}
 @PostMapping("/{id}/cancel") public ApiResponse<?> cancel(@PathVariable Long id,@Valid @RequestBody ProductPricingService.Action a){return ApiResponse.success(service.act(id,a,false));}
 @GetMapping("/{id}/cancellation-preview") public ApiResponse<?> preview(@PathVariable Long id){return ApiResponse.success(service.previewCancellation(id));}
 @PostMapping("/{id}/cancel-reviewed") public ApiResponse<?> cancelReviewed(@PathVariable Long id,@Valid @RequestBody ProductPricingService.ReviewedCancellation input){return ApiResponse.success(service.cancelReviewed(id,input));}
}
