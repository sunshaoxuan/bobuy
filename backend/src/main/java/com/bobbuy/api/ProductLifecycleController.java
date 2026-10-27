package com.bobbuy.api;
import com.bobbuy.api.response.ApiResponse;
import com.bobbuy.service.ProductLifecycleService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/admin/products/trash")
public class ProductLifecycleController {
 private final ProductLifecycleService service;
 public ProductLifecycleController(ProductLifecycleService service){this.service=service;}
 @GetMapping public ApiResponse<?> list(Authentication auth,@RequestParam(defaultValue="true") boolean deleted){return ApiResponse.success(service.list(auth,deleted));}
 @PostMapping("/delete") public ApiResponse<?> delete(Authentication auth,@RequestBody @Valid List<ProductLifecycleService.Selection> rows){service.deleteReviewed(auth,rows);return ApiResponse.success(true);}
 @PostMapping("/restore") public ApiResponse<?> restore(Authentication auth,@RequestBody @Valid ProductLifecycleService.Selection row){service.restore(auth,row);return ApiResponse.success(true);}
}
