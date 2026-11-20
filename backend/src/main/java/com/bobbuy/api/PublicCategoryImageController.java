package com.bobbuy.api;
import com.bobbuy.api.response.ApiResponse;
import com.bobbuy.service.CategoryImageService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/storefront/category-icons")
public class PublicCategoryImageController {
 private final CategoryImageService images;
 public PublicCategoryImageController(CategoryImageService images){this.images=images;}
 @GetMapping public ApiResponse<?> hints(){return ApiResponse.success(images.publicHints());}
}
