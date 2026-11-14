package com.bobbuy.api;
import com.bobbuy.api.response.ApiResponse;
import com.bobbuy.api.response.ApiException;
import com.bobbuy.api.response.ErrorCode;
import com.bobbuy.service.RecommendationRepairService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController @RequestMapping("/api/merchant/recommendations/{id}/repairs")
public class RecommendationRepairController {
 private final RecommendationRepairService service; public RecommendationRepairController(RecommendationRepairService service){this.service=service;}
 public record SourceApply(@Min(0) long version,boolean overwrite,boolean confirmed,@jakarta.validation.constraints.NotNull RecommendationRepairService.SourcePreview preview){}
 public record LocaleApply(@Min(0) long version,boolean confirmed,@Valid @NotEmpty @Size(max=1000) List<RecommendationRepairService.LocaleEdit> edits){}
 @GetMapping("/source-context") public ApiResponse<?> source(@PathVariable Long id,@RequestParam(defaultValue="false") boolean overwrite){return ApiResponse.success(service.previewSource(id,overwrite));}
 @PostMapping("/source-context") public ApiResponse<?> sourceApply(@PathVariable Long id,@Valid @RequestBody SourceApply input){if(!input.confirmed())throw new ApiException(ErrorCode.INVALID_REQUEST,"confirmation required");return ApiResponse.success(service.applySource(id,input.version(),input.overwrite(),input.preview()));}
 @PostMapping("/locale-suggestions") public ApiResponse<?> locales(@PathVariable Long id){return ApiResponse.success(service.suggestLocales(id));}
 @PostMapping("/locale-suggestions/apply") public ApiResponse<?> localeApply(@PathVariable Long id,@Valid @RequestBody LocaleApply input){if(!input.confirmed())throw new ApiException(ErrorCode.INVALID_REQUEST,"confirmation required");service.applyLocales(id,input.version(),input.edits());return ApiResponse.success(null);}
}
