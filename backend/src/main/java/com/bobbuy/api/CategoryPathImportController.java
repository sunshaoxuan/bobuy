package com.bobbuy.api;

import com.bobbuy.api.response.ApiResponse;
import com.bobbuy.security.BobbuyAuthenticatedUser;
import com.bobbuy.service.CategoryPathImportService;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/category-path-import")
public class CategoryPathImportController {
    private final CategoryPathImportService service;
    public CategoryPathImportController(CategoryPathImportService service){this.service=service;}
    private BobbuyAuthenticatedUser user(Authentication auth){if(auth==null||!(auth.getPrincipal() instanceof BobbuyAuthenticatedUser u)||u.id()==null)throw new IllegalStateException("Authenticated user required");return u;}
    private boolean admin(Authentication auth){return auth.getAuthorities().stream().anyMatch(a->"ROLE_PLATFORM_ADMIN".equals(a.getAuthority()));}
    @GetMapping("/template.csv")
    public ResponseEntity<byte[]> template() {
        return ResponseEntity.ok().contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=category-path-template.csv")
                .body(("\uFEFFSKU,costco分类路径,路径来源,备注\r\nFIXTURE-0001,例示親＞例示子,官网面包屑（原文）,合成示例\r\nFIXTURE-0002,例示親>例示子,推定（官网无可用面包屑）,合成示例\r\nFIXTURE-0003,例示親＞例示子,推定（官网无页面）,合成示例\r\n").getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
    @PostMapping(value="/preview",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<?> preview(Authentication auth,@RequestParam MultipartFile file,@RequestParam(required=false) String deferredSkus){var u=user(auth);return ApiResponse.success(service.preview(u.id(),admin(auth),file,deferredSkus));}
    @PostMapping("/{id}/confirm") public ApiResponse<?> confirm(Authentication auth,@PathVariable String id){return ApiResponse.success(service.confirm(user(auth).id(),id));}
    @GetMapping("/audit") public ApiResponse<?> audit(Authentication auth){return ApiResponse.success(service.audit(user(auth).id()));}
    @GetMapping("/{id}/unmatched.csv") public ResponseEntity<byte[]> unmatched(Authentication auth,@PathVariable String id){return ResponseEntity.ok().contentType(MediaType.parseMediaType("text/csv;charset=UTF-8")).header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=unmatched.csv").body(service.unmatchedCsv(user(auth).id(),id));}
}
