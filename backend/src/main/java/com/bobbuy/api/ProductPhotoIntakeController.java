package com.bobbuy.api;

import com.bobbuy.api.response.*;
import com.bobbuy.repository.JdbcCostcoOnboardingJobRepository;
import com.bobbuy.security.MerchantScope;
import com.bobbuy.service.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/product-photo-intake")
public class ProductPhotoIntakeController {
    private final ProductPhotoIntakeService service;private final JdbcCostcoOnboardingJobRepository jobs;private final CostcoEvidencePersistence evidence;
    public ProductPhotoIntakeController(ProductPhotoIntakeService service,JdbcCostcoOnboardingJobRepository jobs,CostcoEvidencePersistence evidence){this.service=service;this.jobs=jobs;this.evidence=evidence;}
    @GetMapping public ApiResponse<?> queue(){
        Long owner=MerchantScope.current();
        if(owner==null)throw new ApiException(ErrorCode.FORBIDDEN,"error.auth.forbidden");
        return ApiResponse.success(jobs.photos(owner));
    }
    @GetMapping("/{id}") public ApiResponse<?> review(@PathVariable String id,@RequestParam(required=false) String itemNumber){return ApiResponse.success(service.review(id,itemNumber));}
    @PostMapping("/{id}/confirm") public ApiResponse<?> confirm(@PathVariable String id,@RequestBody ProductPhotoIntakeService.Confirm input){return ApiResponse.success(service.confirm(id,input));}
    @GetMapping("/products/{id}") public ApiResponse<?> history(@PathVariable String id){return ApiResponse.success(service.productHistory(id));}
    @GetMapping("/{id}/official-image") public ResponseEntity<byte[]> officialImage(@PathVariable String id){var image=service.officialImage(id);return ResponseEntity.ok().contentType(MediaType.parseMediaType(image.contentType())).cacheControl(CacheControl.noStore()).header("X-Content-Type-Options","nosniff").body(image.content());}
    @GetMapping("/{id}/photo") public ResponseEntity<byte[]> photo(@PathVariable String id){
        Long owner=MerchantScope.current();if(owner==null)throw new ApiException(ErrorCode.FORBIDDEN,"error.auth.forbidden");
        var job=jobs.findOwned(id,owner).filter(j->j.privatePhotoSha256()!=null).orElseThrow(()->new ApiException(ErrorCode.RESOURCE_NOT_FOUND,"onboarding.not_found"));
        var image=RecommendationImageValidator.validate(evidence.readVerified(owner,job.privatePhotoSha256()));
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(image.contentType())).cacheControl(CacheControl.noStore()).header("X-Content-Type-Options","nosniff").body(image.content());
    }
    @ExceptionHandler(IllegalArgumentException.class) public ResponseEntity<ApiError> invalid(IllegalArgumentException e){return ResponseEntity.badRequest().body(new ApiError("INVALID_REQUEST","photo.invalid"));}
}
