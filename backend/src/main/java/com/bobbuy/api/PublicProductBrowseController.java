package com.bobbuy.api;
import com.bobbuy.api.response.*;
import com.bobbuy.service.PublicProductBrowseService;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/storefront/product-browse")
public class PublicProductBrowseController {
 private final PublicProductBrowseService service;
 public PublicProductBrowseController(PublicProductBrowseService s){service=s;}
 @GetMapping public ApiResponse<?> browse(@RequestParam(defaultValue="0") int page,@RequestParam(required=false) Long merchantId,
  @RequestParam(defaultValue="") String query,@RequestParam(defaultValue="") String category,@RequestParam(defaultValue="ja-JP") String locale,
  @RequestParam(defaultValue="false") boolean marked,@RequestParam(required=false) String revision){return ApiResponse.success(service.browse(page,merchantId,query,category,locale,marked,revision));}
 @GetMapping("/{id}") public ApiResponse<?> detail(@PathVariable String id,@RequestParam(required=false) Long merchantId){return ApiResponse.success(service.detail(id,merchantId));}
 @ExceptionHandler(PublicProductBrowseService.Changed.class) public ResponseEntity<ApiError> changed(){return ResponseEntity.status(409).body(new ApiError("BROWSE_CHANGED","Restart browse at page 0"));}
 @ExceptionHandler(PublicProductBrowseService.Missing.class) public ResponseEntity<ApiError> missing(){return ResponseEntity.status(404).body(new ApiError("RESOURCE_NOT_FOUND","Product not found"));}
 @ExceptionHandler({IllegalArgumentException.class,org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class}) public ResponseEntity<ApiError> invalid(){return ResponseEntity.badRequest().body(new ApiError("INVALID_REQUEST","Invalid public browse query"));}
}
