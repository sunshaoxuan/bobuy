package com.bobbuy.api;
import com.bobbuy.service.ProductMarkerService;
import com.bobbuy.api.response.ApiResponse;
import java.util.List;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/merchant/product-markers")
public class ProductMarkerController {
 private final ProductMarkerService service;
 public ProductMarkerController(ProductMarkerService s){service=s;}
 @GetMapping public ApiResponse<?> list(){return ApiResponse.success(service.definitions());}
 @PostMapping public ApiResponse<?> create(@RequestBody ProductMarkerService.Input i){return ApiResponse.success(service.save(null,i));}
 @PutMapping("/{id}") public ApiResponse<?> update(@PathVariable String id,@RequestBody ProductMarkerService.Input i){return ApiResponse.success(service.save(id,i));}
 @PostMapping("/defaults") public ApiResponse<?> defaults(){return ApiResponse.success(service.defaults());}
 @GetMapping("/products/{id}") public ApiResponse<?> get(@PathVariable String id){return ApiResponse.success(service.assignment(id));}
 public record Assign(List<String> markerIds,long version){}
 @PutMapping("/products/{id}") public ApiResponse<?> assign(@PathVariable String id,@RequestBody Assign i){return ApiResponse.success(service.assign(id,i.markerIds(),i.version()));}
}
