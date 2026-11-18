package com.bobbuy.service;

import com.bobbuy.model.Product;
import com.bobbuy.repository.CategoryLegacyMappingRepository;
import com.bobbuy.repository.CategoryRepository;
import com.bobbuy.repository.ProductPrimaryCategoryPathRepository;
import org.springframework.stereotype.Service;

@Service
public class ProductCategoryPathResolver {
    public static final String UNCATEGORIZED_NODE_ID = "system-uncategorized";

    private final ProductPrimaryCategoryPathRepository primaryPaths;
    private final CategoryLegacyMappingRepository legacyMappings;
    private final CategoryRepository legacyCategories;

    public ProductCategoryPathResolver(ProductPrimaryCategoryPathRepository primaryPaths,
                                       CategoryLegacyMappingRepository legacyMappings,
                                       CategoryRepository legacyCategories) {
        this.primaryPaths = primaryPaths;
        this.legacyMappings = legacyMappings;
        this.legacyCategories = legacyCategories;
    }

    public ResolvedCategory resolve(Product product) {
        var primary = primaryPaths.findById(product.getId());
        if (primary.isPresent()) {
            return new ResolvedCategory(Source.PRIMARY_PATH, primary.get().getCategoryNodeId());
        }
        var legacyId = product.getCategoryId();
        if (legacyId != null && !legacyId.isBlank()) {
            var mapped = legacyMappings.findById(legacyId);
            if (mapped.isPresent()) {
                return new ResolvedCategory(Source.LEGACY_MAPPING, mapped.get().getCategoryNodeId());
            }
            if (legacyCategories.existsById(legacyId)) {
                return new ResolvedCategory(Source.LEGACY_FLAT, legacyId);
            }
        }
        return new ResolvedCategory(Source.UNCATEGORIZED, UNCATEGORIZED_NODE_ID);
    }

    /** Bounded batch counterpart of resolve, retaining explicit uncategorized assignments. */
    public java.util.Map<String,ResolvedCategory> resolveAll(java.util.Collection<Product> products) {
        var result=new java.util.HashMap<String,ResolvedCategory>();
        var primary=new java.util.HashMap<String,String>();
        primaryPaths.findAllById(products.stream().map(Product::getId).toList()).forEach(p->primary.put(p.getProductId(),p.getCategoryNodeId()));
        var legacyIds=products.stream().filter(p->!primary.containsKey(p.getId())).map(Product::getCategoryId).filter(id->id!=null&&!id.isBlank()).distinct().toList();
        var mappings=new java.util.HashMap<String,String>();legacyMappings.findAllById(legacyIds).forEach(m->mappings.put(m.getLegacyCategoryId(),m.getCategoryNodeId()));
        var existing=new java.util.HashSet<String>();legacyCategories.findAllById(legacyIds).forEach(c->existing.add(c.getId()));
        for(var p:products){String id=p.getId(),legacy=p.getCategoryId();result.put(id,primary.containsKey(id)?new ResolvedCategory(Source.PRIMARY_PATH,primary.get(id)):mappings.containsKey(legacy)?new ResolvedCategory(Source.LEGACY_MAPPING,mappings.get(legacy)):existing.contains(legacy)?new ResolvedCategory(Source.LEGACY_FLAT,legacy):new ResolvedCategory(Source.UNCATEGORIZED,UNCATEGORIZED_NODE_ID));}
        return result;
    }

    public enum Source { PRIMARY_PATH, LEGACY_MAPPING, LEGACY_FLAT, UNCATEGORIZED }
    public record ResolvedCategory(Source source, String categoryId) {}
}
