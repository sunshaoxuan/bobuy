package com.bobbuy.api;
import com.bobbuy.api.response.*;
import com.bobbuy.service.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/storefront/recommendation-browse")
public class PublicRecommendationBrowseController {
 private final PublicRecommendationBrowseService service;
 public PublicRecommendationBrowseController(PublicRecommendationBrowseService s){service=s;}
 @GetMapping("/issues") public ApiResponse<?> issues(@RequestParam(defaultValue="0") int page,@RequestParam(required=false) Long merchantId,@RequestParam(defaultValue="ja-JP") String locale,@RequestParam(defaultValue="all") String period,@RequestParam(defaultValue="") String query,@RequestParam(required=false) String revision){return ApiResponse.success(service.directory(page,merchantId,locale,period,query,revision));}
 @GetMapping("/items") public ApiResponse<?> items(@RequestParam(defaultValue="0") int page,@RequestParam(required=false) Long merchantId,@RequestParam(required=false) Long issueId,@RequestParam(defaultValue="ja-JP") String locale,@RequestParam(defaultValue="current") String period,@RequestParam(defaultValue="") String query,@RequestParam(defaultValue="") String category,@RequestParam(required=false) String revision){return ApiResponse.success(service.page(page,merchantId,issueId,locale,period,query,category,revision));}
 @ExceptionHandler(PublicProductBrowseService.Changed.class) public ResponseEntity<ApiError> changed(){return ResponseEntity.status(409).body(new ApiError("BROWSE_CHANGED","Restart browse at page 0"));}
 @ExceptionHandler({IllegalArgumentException.class,org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class}) public ResponseEntity<ApiError> invalid(){return ResponseEntity.badRequest().body(new ApiError("INVALID_REQUEST","Invalid recommendation browse query"));}
}
