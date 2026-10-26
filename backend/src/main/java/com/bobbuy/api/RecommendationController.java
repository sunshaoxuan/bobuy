package com.bobbuy.api;

import com.bobbuy.api.response.*;
import com.bobbuy.service.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.*;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.math.BigDecimal;
import java.util.List;

@RestController
@Validated
public class RecommendationController {
    @ExceptionHandler({jakarta.validation.ConstraintViolationException.class, org.springframework.web.multipart.MaxUploadSizeExceededException.class,
        org.springframework.web.method.annotation.HandlerMethodValidationException.class})
    public ResponseEntity<ApiError> invalidInput(Exception exception) {
        var locale = org.springframework.context.i18n.LocaleContextHolder.getLocale();
        String message = java.util.ResourceBundle.getBundle("messages", locale).getString("error.recommendation.invalid");
        return ResponseEntity.badRequest().body(new ApiError(ErrorCode.INVALID_REQUEST.name(), message));
    }
    private final RecommendationService service;
    private final RecommendationSourceImage sourceImages;
    private final ProductSaleService currencyService;
    public RecommendationController(RecommendationService service, RecommendationSourceImage sourceImages,ProductSaleService currencyService) { this.service = service; this.sourceImages = sourceImages; this.currencyService=currencyService; }
    public record ItemEdit(@NotNull @Valid RecommendationFacts facts, @Min(0) long version) {}
    public record SourceImage(@NotNull @Valid RecommendationFacts facts, @NotBlank @Size(max=2048) String imageUrl, @Min(0) long version) {}
    public record Edit(@NotNull @Size(max = 200) String title, @NotNull @Size(max = 100000) String body, @Min(0) long version) {}
    public record Version(@Min(0) long version) {}
    public record CatalogLink(@NotEmpty @Size(max=500) List<@NotNull Long> itemIds, @Size(max=255) String productId, @Min(0) long version) {}
    @PutMapping("/api/merchant/recommendations/{id}/catalog")
    public ApiResponse<?> catalog(@PathVariable Long id,@Valid @RequestBody CatalogLink input){return ApiResponse.success(service.catalog(id,input.itemIds(),input.productId(),input.version()));}
    @PostMapping(value="/api/merchant/recommendations/{id}/items/{itemId}/gallery",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<?> picture(@PathVariable Long id,@PathVariable Long itemId,@RequestParam long version,
        @RequestParam String sourceUrl,@RequestParam String assetKey,@RequestParam(defaultValue="") String label,
        @RequestParam(required=false) String itemNumber,@RequestParam boolean verified,@RequestParam MultipartFile file){
        return ApiResponse.success(service.picture(id,itemId,version,RecommendationImageValidator.validate(file),sourceUrl,assetKey,label,itemNumber,verified));
    }
    public record Gallery(@NotNull @Size(max=100) List<@NotBlank String> orderedIds,@Min(0) long version){}
    @PutMapping("/api/merchant/recommendations/{id}/items/{itemId}/gallery")
    public ApiResponse<?> gallery(@PathVariable Long id,@PathVariable Long itemId,@Valid @RequestBody Gallery input){return ApiResponse.success(service.gallery(id,itemId,input.version(),input.orderedIds()));}
    public record Localizations(@NotEmpty @Size(max=200) @Valid List<RecommendationService.Localization> rows,@Min(0) long version,boolean reviewed) {}
    @PutMapping("/api/merchant/recommendations/{id}/localizations")
    public ApiResponse<?> localizations(@PathVariable Long id,@Valid @RequestBody Localizations input){
        if(!input.reviewed())throw new ApiException(ErrorCode.INVALID_REQUEST,"translation.review_required");
        return ApiResponse.success(service.localize(id,input.rows(),input.version()));
    }
    public record Sales(@NotEmpty @Size(max=500) @Valid List<ProductSaleService.Review> reviews,@Min(0) long version,boolean confirmedPreorder) {}
    @PutMapping("/api/merchant/recommendations/{id}/sales")
    public ApiResponse<?> sales(@PathVariable Long id,@Valid @RequestBody Sales input){return ApiResponse.success(service.reviewSales(id,input.reviews(),input.version(),input.confirmedPreorder()));}
    @GetMapping({"/api/storefront/currencies","/api/merchant/currencies"})
    public ApiResponse<?> currencies(){return ApiResponse.success(currencyService.currencies());}
    @GetMapping("/api/merchant/recommendations")
    public ApiResponse<?> list(@RequestParam(defaultValue = "0") @Min(0) int page) { return ApiResponse.success(service.list(page)); }
    @PostMapping("/api/merchant/recommendations")
    public ApiResponse<?> create() { return ApiResponse.success(service.create()); }
    @GetMapping("/api/merchant/recommendations/{id}")
    public ApiResponse<?> get(@PathVariable Long id) { return ApiResponse.success(service.get(id, false)); }
    @PutMapping("/api/merchant/recommendations/{id}")
    public ApiResponse<?> save(@PathVariable Long id, @Valid @RequestBody Edit request) { return ApiResponse.success(service.save(id, request.title(), request.body(), request.version())); }
    @PostMapping("/api/merchant/recommendations/{id}/publish")
    public ApiResponse<?> publish(@PathVariable Long id, @Valid @RequestBody Version request) { return ApiResponse.success(service.publish(id, request.version(), true)); }
    @PostMapping("/api/merchant/recommendations/{id}/withdraw")
    public ApiResponse<?> withdraw(@PathVariable Long id, @Valid @RequestBody Version request) { return ApiResponse.success(service.publish(id, request.version(), false)); }
    @DeleteMapping("/api/merchant/recommendations/{id}/items/{itemId}")
    public ApiResponse<?> remove(@PathVariable Long id, @PathVariable Long itemId, @RequestParam @Min(0) long version) { return ApiResponse.success(service.removeItem(id, itemId, version)); }
    @PostMapping(value = "/api/merchant/recommendations/{id}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<?> upload(@PathVariable Long id, @Valid @ModelAttribute RecommendationFacts facts,
            @RequestParam @Min(0) long version, @RequestParam MultipartFile file) {
        return ApiResponse.success(service.upload(id, facts, version, RecommendationImageValidator.validate(file)));
    }
    @PostMapping("/api/merchant/recommendations/{id}/source-image")
    public ApiResponse<?> sourceImage(@PathVariable Long id, @Valid @RequestBody SourceImage request) {
        // Check ownership before making an outbound request.
        service.get(id, false);
        return ApiResponse.success(service.upload(id, request.facts(), request.version(), sourceImages.fetch(request.imageUrl())));
    }
    @PutMapping("/api/merchant/recommendations/{id}/items/{itemId}")
    public ApiResponse<?> editItem(@PathVariable Long id, @PathVariable Long itemId, @Valid @RequestBody ItemEdit request) {
        return ApiResponse.success(service.editItem(id,itemId,request.facts(),request.version()));
    }
    @GetMapping("/api/storefront/recommendations")
    public ApiResponse<?> publicList(@RequestParam(defaultValue = "0") @Min(0) int page, @RequestParam(required = false) @Min(1) Long merchantId) { return ApiResponse.success(service.publicFeed(page, merchantId)); }
    @GetMapping("/api/storefront/recommendation-nodes")
    public ApiResponse<?> publicNodes() { return ApiResponse.success(service.publicNodes()); }
    @GetMapping("/api/storefront/recommendations/{id}")
    public ApiResponse<?> publicGet(@PathVariable Long id, @RequestParam(required = false) @Min(1) Long merchantId) { return ApiResponse.success(service.publicGet(id, merchantId)); }
    @GetMapping("/api/storefront/recommendation-images/{id}")
    public ResponseEntity<byte[]> image(@PathVariable String id) {
        var image = service.image(id);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(image.contentType))
            .header("X-Content-Type-Options", "nosniff").header("Content-Disposition", "inline")
            .cacheControl(CacheControl.maxAge(java.time.Duration.ofDays(30)).cachePublic().immutable()).body(image.content);
    }
}
