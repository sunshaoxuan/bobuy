package com.bobbuy.api;
import com.bobbuy.service.*;
import com.bobbuy.api.response.*;
import org.springframework.http.ResponseEntity;
import java.util.List;
import jakarta.validation.constraints.*;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
@RestController @Validated
public class PublicProductMarkerController {
 @ExceptionHandler({jakarta.validation.ConstraintViolationException.class,org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class})
 public ResponseEntity<ApiError> invalidQuery(Exception error){return ResponseEntity.badRequest().body(new ApiError(ErrorCode.INVALID_REQUEST.name(),java.util.ResourceBundle.getBundle("messages",org.springframework.context.i18n.LocaleContextHolder.getLocale()).getString("error.marker.invalid")));}
 private final ProductMarkerService service;private final PublicProductCatalogService catalog;
 public PublicProductMarkerController(ProductMarkerService s,PublicProductCatalogService c){service=s;catalog=c;}
 @GetMapping("/api/storefront/product-marker-assignments") public ApiResponse<?> assignments(@RequestParam List<String> productIds){return ApiResponse.success(service.publicAssignments(productIds));}
 @GetMapping("/api/storefront/marked-product-catalog") public ApiResponse<?> marked(@RequestParam(defaultValue="0") @Min(0) @Max(100000) int page,@RequestParam(required=false) @Min(1) Long merchantId){return ApiResponse.success(catalog.page(page,merchantId,service.markedProductIds(merchantId)));}
}
