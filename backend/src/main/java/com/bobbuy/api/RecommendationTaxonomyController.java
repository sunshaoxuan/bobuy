package com.bobbuy.api;

import com.bobbuy.api.response.ApiResponse;
import com.bobbuy.service.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
public class RecommendationTaxonomyController {
    private final RecommendationTaxonomyService taxonomy;
    private final RecommendationService recommendations;
    public RecommendationTaxonomyController(RecommendationTaxonomyService taxonomy,RecommendationService recommendations) {this.taxonomy=taxonomy;this.recommendations=recommendations;}
    public record Label(@NotBlank @Size(max=100) String name,@NotNull @Pattern(regexp="zh-CN|zh-TW|ja-JP|en-US") String locale) {}
    public record Assignment(@NotEmpty @Size(max=2000) List<@NotNull Long> itemIds,
        @NotNull @Size(max=100) List<@NotBlank @Size(max=255) String> categoryIds,
        @NotNull @Pattern(regexp="add|remove|replace") String categoryMode,boolean updateCategories,
        @Size(max=255) String supplierId,boolean updateSupplier,boolean showSupplier,@Min(0) long version) {}
    @GetMapping("/api/merchant/recommendation-taxonomy")
    public ApiResponse<?> options() {return ApiResponse.success(taxonomy.options());}
    @PostMapping("/api/merchant/recommendation-taxonomy/categories")
    public ApiResponse<?> create(@Valid @RequestBody Label label) {return ApiResponse.success(taxonomy.category(null,label.name(),label.locale()));}
    @PutMapping("/api/merchant/recommendation-taxonomy/categories/{id}")
    public ApiResponse<?> rename(@PathVariable String id,@Valid @RequestBody Label label) {return ApiResponse.success(taxonomy.category(id,label.name(),label.locale()));}
    @PutMapping("/api/merchant/recommendations/{id}/classification")
    public ApiResponse<?> assign(@PathVariable Long id,@Valid @RequestBody Assignment request) {
        return ApiResponse.success(recommendations.classify(id,request.itemIds(),request.categoryIds(),request.categoryMode(),request.updateCategories(),request.supplierId(),request.updateSupplier(),request.showSupplier(),request.version()));
    }
}
