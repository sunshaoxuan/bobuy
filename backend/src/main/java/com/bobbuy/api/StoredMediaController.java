package com.bobbuy.api;
import com.bobbuy.service.ImageStorageService;
import com.bobbuy.service.MediaBinaryService;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/merchant/media")
public class StoredMediaController {
 private final ImageStorageService storage;
 private final MediaBinaryService binaries;
 public StoredMediaController(ImageStorageService storage,MediaBinaryService binaries){this.storage=storage;this.binaries=binaries;}
 @GetMapping("/{id}") public ResponseEntity<byte[]> image(@PathVariable String id){
  var image=storage.privateImage(id);
  return ResponseEntity.ok().contentType(MediaType.parseMediaType(image.contentType))
   .cacheControl(CacheControl.noStore()).header("X-Content-Type-Options","nosniff")
   .header("Content-Disposition","inline").body(binaries.read(image));
 }
}
