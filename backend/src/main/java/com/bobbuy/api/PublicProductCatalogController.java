package com.bobbuy.api;
import com.bobbuy.api.response.ApiResponse;
import com.bobbuy.service.PublicProductCatalogService;
import jakarta.validation.constraints.*;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
@RestController @Validated
public class PublicProductCatalogController {
 private final PublicProductCatalogService catalog;
 public PublicProductCatalogController(PublicProductCatalogService c){catalog=c;}
 @GetMapping("/api/storefront/product-catalog")
 public ApiResponse<PublicProductCatalogService.Page> page(@RequestParam(defaultValue="0") @Min(0) @Max(100000) int page,@RequestParam(required=false) @Min(1) Long merchantId){return ApiResponse.success(catalog.page(page,merchantId));}
}
