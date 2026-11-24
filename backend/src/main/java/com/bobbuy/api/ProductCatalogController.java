package com.bobbuy.api;
import com.bobbuy.service.ProductCatalogService;
import com.bobbuy.api.response.ApiResponse;
import org.springframework.web.bind.annotation.*;
import java.util.List;
@RestController
@RequestMapping("/api/merchant/product-catalog")
public class ProductCatalogController {
 private final ProductCatalogService service;
 public ProductCatalogController(ProductCatalogService service){this.service=service;}
 public record Batch(List<ProductCatalogService.Input> rows,boolean reviewed) {}
 @GetMapping("/{id}") public ApiResponse<?> get(@PathVariable String id){return ApiResponse.success(service.get(id));}
 @GetMapping public ApiResponse<?> proposals(){return ApiResponse.success(service.proposals());}
 @GetMapping("/audit") public ApiResponse<?> audit(){return ApiResponse.success(service.audit());}
 @PostMapping("/preview") public ApiResponse<?> preview(@RequestBody Batch input){return ApiResponse.success(service.preview(input.rows()));}
 @PutMapping public ApiResponse<?> save(@RequestBody Batch input){return ApiResponse.success(service.save(input.rows(),input.reviewed()));}
 public record Restore(String checkpointId,long version,boolean reviewed){}
 @PostMapping("/{id}/restore") public ApiResponse<?> restore(@PathVariable String id,@RequestBody Restore input){return ApiResponse.success(service.restore(id,input.checkpointId(),input.version(),input.reviewed()));}
 @PostMapping(value="/{id}/images",consumes=org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
 public ApiResponse<?> image(@PathVariable String id,@RequestParam(required=false) org.springframework.web.multipart.MultipartFile file,@RequestParam(required=false) String sourceUrl,@RequestParam(required=false) String label,@RequestParam(required=false) Boolean verified){
  return ApiResponse.success(service.upload(id,com.bobbuy.service.RecommendationImageValidator.validateCatalog(file),sourceUrl,label,verified));
 }
}
