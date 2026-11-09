package com.bobbuy.api;

import com.bobbuy.api.response.*;
import com.bobbuy.service.RecommendationIssueDateService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/merchant/recommendations/{id}/issue-date")
public class RecommendationIssueDateController {
    private final RecommendationIssueDateService service;
    public RecommendationIssueDateController(RecommendationIssueDateService service){this.service=service;}
    @GetMapping public ApiResponse<?> get(@PathVariable Long id){return ApiResponse.success(service.get(id));}
    @PutMapping public ApiResponse<?> save(@PathVariable Long id,@Valid @RequestBody RecommendationIssueDateRequest request){return ApiResponse.success(service.save(id,request));}
    @ExceptionHandler(RecommendationIssueDateService.Changed.class)
    public ResponseEntity<ApiError> changed(){
        var locale=org.springframework.context.i18n.LocaleContextHolder.getLocale();
        return ResponseEntity.status(409).body(new ApiError("RECOMMENDATION_CHANGED",java.util.ResourceBundle.getBundle("messages",locale).getString("error.recommendation.conflict")));
    }
}
