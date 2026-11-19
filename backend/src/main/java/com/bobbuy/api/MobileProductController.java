package com.bobbuy.api;

import com.bobbuy.api.response.ApiException;
import com.bobbuy.api.response.ApiResponse;
import com.bobbuy.api.response.ErrorCode;
import com.bobbuy.model.Product;
import com.bobbuy.model.ProductPatch;
import com.bobbuy.service.BobbuyStore;
import com.bobbuy.service.LocalizedJsonbReaderService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Locale;

@RestController
@RequestMapping("/api/mobile/products")
public class MobileProductController {
    private final BobbuyStore store;
    @org.springframework.beans.factory.annotation.Autowired private com.bobbuy.service.ProductCategoryPathResolver categoryPaths;
    @org.springframework.beans.factory.annotation.Autowired private com.bobbuy.repository.CategoryTreeNodeRepository categoryNodes;
    private final LocalizedJsonbReaderService localizedJsonbReaderService;
    @org.springframework.beans.factory.annotation.Autowired private com.bobbuy.service.ProductSaleService prices;

    public MobileProductController(BobbuyStore store, LocalizedJsonbReaderService localizedJsonbReaderService) {
        this.store = store;
        this.localizedJsonbReaderService = localizedJsonbReaderService;
    }

    @org.springframework.beans.factory.annotation.Autowired private com.bobbuy.service.ManualProductCreationService manualCreation;

    @org.springframework.web.bind.annotation.PostMapping
    public ResponseEntity<ApiResponse<MobileProductResponse>> create(@RequestBody com.bobbuy.service.ManualProductCreationService.Input input, Locale locale) {
        return ResponseEntity.ok(ApiResponse.success(toResponse(manualCreation.create(input),locale)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<java.util.List<MobileProductResponse>>> list(Locale locale) {
        try {
            var source=store.listProducts();var paths=categoryLabels(source,locale);
            java.util.List<MobileProductResponse> products = source.stream()
                    .map(product -> toResponse(product, locale, paths.get(product.getId())))
                    .toList();
            return ResponseEntity.ok(ApiResponse.success(products));
        } catch (Exception e) {
            org.slf4j.LoggerFactory.getLogger(MobileProductController.class).error("Failed to list products", e);
            throw e;
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<MobileProductResponse>> get(@PathVariable String id, Locale locale) {
        Product product = store.getProduct(id)
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND, "error.product.not_found"));
        return ResponseEntity.ok(ApiResponse.success(toResponse(product, locale)));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ApiResponse<MobileProductResponse>> patch(@PathVariable String id,
                                                                     @RequestBody ProductPatch patch,
                                                                     Locale locale) {
        Product updated = store.patchProduct(id, patch)
                .orElseThrow(() -> new ApiException(ErrorCode.RESOURCE_NOT_FOUND, "error.product.not_found"));
        return ResponseEntity.ok(ApiResponse.success(toResponse(updated, locale)));
    }

    @org.springframework.web.bind.annotation.DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable String id) {
        if (store.deleteProduct(id)) {
            return ResponseEntity.ok(ApiResponse.success(null));
        }
        throw new ApiException(ErrorCode.RESOURCE_NOT_FOUND, "error.product.not_found");
    }

    private java.util.Map<String,String> categoryLabels(java.util.List<Product> products,Locale locale) {
        var resolved=categoryPaths.resolveAll(products);
        var leaves=new java.util.HashMap<String,com.bobbuy.model.CategoryTreeNode>();
        categoryNodes.findAllById(resolved.values().stream().map(com.bobbuy.service.ProductCategoryPathResolver.ResolvedCategory::categoryId).distinct().toList()).forEach(n->leaves.put(n.getId(),n));
        var nodes=new java.util.HashMap<>(leaves);
        var ancestors=leaves.values().stream().flatMap(n->n.getFullPath().stream()).filter(id->!nodes.containsKey(id)).distinct().toList();
        if(!ancestors.isEmpty())categoryNodes.findAllById(ancestors).forEach(n->nodes.put(n.getId(),n));
        var result=new java.util.HashMap<String,String>();
        resolved.forEach((productId,path)->{var leaf=leaves.get(path.categoryId());if(leaf!=null){var names=new java.util.ArrayList<String>();for(var id:leaf.getFullPath()){var node=nodes.get(id);if(node!=null){var name=node.getName().get(locale.toLanguageTag());if(name==null||name.isBlank())name=node.getName().get("ja-JP");if(name!=null&&!name.isBlank())names.add(name);}}result.put(productId,String.join(" › ",names));}});
        return result;
    }
    private MobileProductResponse toResponse(Product product,Locale locale) {
        return product==null?null:toResponse(product,locale,categoryLabels(java.util.List.of(product),locale).get(product.getId()));
    }
    private MobileProductResponse toResponse(Product product, Locale locale,String categoryPath) {
        if (product == null) return null;
        String displayName = localizedJsonbReaderService.read(product.getName() != null ? product.getName() : java.util.Collections.emptyMap(), locale);
        String displayDescription = localizedJsonbReaderService.read(product.getDescription() != null ? product.getDescription() : java.util.Collections.emptyMap(), locale);
        var response=new MobileProductResponse(product, displayName, displayDescription);response.setCurrentRegular(prices.currentRegular(product));response.setCategoryPath(categoryPath);return response;
    }
}
