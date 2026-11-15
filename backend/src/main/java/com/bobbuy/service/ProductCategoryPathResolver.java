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

    public enum Source { PRIMARY_PATH, LEGACY_MAPPING, LEGACY_FLAT, UNCATEGORIZED }
    public record ResolvedCategory(Source source, String categoryId) {}
}
