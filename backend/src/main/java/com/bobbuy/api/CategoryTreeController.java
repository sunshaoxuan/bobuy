package com.bobbuy.api;

import com.bobbuy.api.response.ApiResponse;
import com.bobbuy.service.CategoryTreeManagementService;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController @RequestMapping("/api/category-tree")
public class CategoryTreeController {
 private final CategoryTreeManagementService service;public CategoryTreeController(CategoryTreeManagementService service){this.service=service;}
 @GetMapping public ApiResponse<List<CategoryTreeManagementService.Node>> list(){return ApiResponse.success(service.list());}
 @PostMapping public ApiResponse<CategoryTreeManagementService.Node> create(@RequestBody CategoryTreeManagementService.Edit edit){return ApiResponse.success(service.create(edit));}
 @PutMapping("/{id}") public ApiResponse<CategoryTreeManagementService.Node> update(@PathVariable String id,@RequestBody CategoryTreeManagementService.Edit edit){return ApiResponse.success(service.update(id,edit));}
 @DeleteMapping("/{id}") public ApiResponse<Void> delete(@PathVariable String id){service.delete(id);return ApiResponse.success(null);}
 @GetMapping("/products/{id}") public ApiResponse<CategoryTreeManagementService.ProductPath> product(@PathVariable String id){return ApiResponse.success(service.product(id));}
 @PutMapping("/products/{id}") public ApiResponse<CategoryTreeManagementService.ProductPath> assign(@PathVariable String id,@RequestBody CategoryTreeManagementService.ProductPath path){return ApiResponse.success(service.assign(id,path));}
}
