package com.bobbuy.api;
import com.bobbuy.service.ImageStorageService;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/merchant/media")
public class StoredMediaController {
 private final ImageStorageService storage;
 public StoredMediaController(ImageStorageService storage){this.storage=storage;}
 @GetMapping("/{id}") public ResponseEntity<byte[]> image(@PathVariable String id){
  var image=storage.privateImage(id);
  return ResponseEntity.ok().contentType(MediaType.parseMediaType(image.contentType))
   .cacheControl(CacheControl.noStore()).header("X-Content-Type-Options","nosniff")
   .header("Content-Disposition","inline").body(image.content);
 }
}
