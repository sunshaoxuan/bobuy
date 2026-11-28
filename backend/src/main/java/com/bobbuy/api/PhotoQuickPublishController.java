package com.bobbuy.api;
import com.bobbuy.api.response.*;
import com.bobbuy.service.*;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import java.io.IOException;
import java.util.*;

@RestController @RequestMapping("/api/photo-quick-publish")
public class PhotoQuickPublishController {
 private final PhotoQuickPublishService service;
 public PhotoQuickPublishController(PhotoQuickPublishService service){this.service=service;}
 public record Create(String requestKey,String supplierId,String market){}
 @PostMapping public ApiResponse<?> create(@RequestBody Create value){return ApiResponse.success(service.create(value.requestKey(),value.supplierId(),value.market()));}
 @GetMapping("/{id}") public ApiResponse<?> get(@PathVariable String id){return ApiResponse.success(service.get(id));}
 @PostMapping("/{id}/seal") public ApiResponse<?> seal(@PathVariable String id){return ApiResponse.success(service.seal(id));}
 @PostMapping(value="/{id}/items",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
 public ApiResponse<?> add(@PathVariable String id,@RequestParam String requestKey,@RequestParam("files") List<org.springframework.web.multipart.MultipartFile> files)throws IOException{if(files.stream().anyMatch(f->f.isEmpty()||f.getSize()>RecommendationImageValidator.MAX_BYTES))throw new ApiException(ErrorCode.INVALID_REQUEST,"error.recommendation.image");var bytes=new ArrayList<byte[]>();for(var file:files)bytes.add(file.getBytes());return ApiResponse.success(service.add(id,requestKey,bytes));}
 @PostMapping("/{batch}/items/{item}/exclude") public ApiResponse<?> exclude(@PathVariable String batch,@PathVariable String item,@RequestParam long revision){return ApiResponse.success(service.exclude(batch,item,revision));}
}
