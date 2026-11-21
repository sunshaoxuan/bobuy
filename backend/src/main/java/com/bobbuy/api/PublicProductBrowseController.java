package com.bobbuy.api;
import com.bobbuy.api.response.*;
import com.bobbuy.service.PublicProductBrowseService;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/storefront/product-browse")
public class PublicProductBrowseController {
 private final PublicProductBrowseService service;
 public PublicProductBrowseController(PublicProductBrowseService s){service=s;}
 @GetMapping public ApiResponse<?> browse(@RequestParam(defaultValue="0") int page,@RequestParam(required=false) Long merchantId,
  @RequestParam(defaultValue="") String query,@RequestParam(defaultValue="") String category,@RequestParam(defaultValue="ja-JP") String locale,
  @RequestParam(defaultValue="default") String sort,@RequestParam(defaultValue="false") boolean marked,@RequestParam(defaultValue="true") boolean markedFirst,@RequestParam(required=false) String revision,@RequestParam(defaultValue="false") boolean sections,@RequestParam(required=false) Integer offset,@RequestParam(required=false) Integer limit){return ApiResponse.success(offset!=null||limit!=null?service.range(merchantId,query,category,locale,marked,revision,sort,markedFirst,sections?"":null,sections,offset,limit):service.browse(page,merchantId,query,category,locale,marked,revision,sort,markedFirst));}
 @GetMapping("/overview") public ApiResponse<?> overview(@RequestParam(required=false) Long merchantId,@RequestParam(defaultValue="ja-JP") String locale,@RequestParam(defaultValue="true") boolean markedFirst,@RequestParam(defaultValue="false") boolean sections,@RequestParam(defaultValue="") String category,@RequestParam(required=false) Integer offset,@RequestParam(required=false) Integer limit){return ApiResponse.success(offset!=null||limit!=null?service.range(merchantId,"",category,locale,false,null,"default",markedFirst,"",true,offset,limit):sections?service.sections(0,merchantId,locale,markedFirst,"","",null):service.overview(merchantId,locale,markedFirst));}
 @GetMapping("/shelf") public ApiResponse<?> shelf(@RequestParam(required=false) Long merchantId,@RequestParam(defaultValue="ja-JP") String locale,@RequestParam(defaultValue="true") boolean markedFirst,@RequestParam String category,@RequestParam String revision,@RequestParam(defaultValue="false") boolean sections,@RequestParam(defaultValue="") String scopeCategory,@RequestParam(defaultValue="0") int page,@RequestParam(required=false) Integer offset,@RequestParam(required=false) Integer limit){return ApiResponse.success(offset!=null||limit!=null?service.range(merchantId,"",scopeCategory,locale,false,revision,"default",markedFirst,category,true,offset,limit):sections?service.sections(page,merchantId,locale,markedFirst,scopeCategory,category,revision):service.shelf(merchantId,locale,markedFirst,category,revision));}
 @GetMapping("/{id}") public ApiResponse<?> detail(@PathVariable String id,@RequestParam(required=false) Long merchantId){return ApiResponse.success(service.detail(id,merchantId));}
 @ExceptionHandler(PublicProductBrowseService.Changed.class) public ResponseEntity<ApiError> changed(){return ResponseEntity.status(409).body(new ApiError("BROWSE_CHANGED","Restart browse at page 0"));}
 @ExceptionHandler(PublicProductBrowseService.Missing.class) public ResponseEntity<ApiError> missing(){return ResponseEntity.status(404).body(new ApiError("RESOURCE_NOT_FOUND","Product not found"));}
 @ExceptionHandler({IllegalArgumentException.class,org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class}) public ResponseEntity<ApiError> invalid(){return ResponseEntity.badRequest().body(new ApiError("INVALID_REQUEST","Invalid public browse query"));}
}
