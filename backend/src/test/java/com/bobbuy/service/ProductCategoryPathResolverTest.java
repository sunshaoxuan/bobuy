package com.bobbuy.service;

import com.bobbuy.model.CategoryLegacyMapping;
import com.bobbuy.model.Product;
import com.bobbuy.model.ProductPrimaryCategoryPath;
import com.bobbuy.repository.CategoryLegacyMappingRepository;
import com.bobbuy.repository.CategoryRepository;
import com.bobbuy.repository.ProductPrimaryCategoryPathRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ProductCategoryPathResolverTest {
    private final ProductPrimaryCategoryPathRepository paths = mock(ProductPrimaryCategoryPathRepository.class);
    private final CategoryLegacyMappingRepository mappings = mock(CategoryLegacyMappingRepository.class);
    private final CategoryRepository legacy = mock(CategoryRepository.class);
    private final ProductCategoryPathResolver resolver = new ProductCategoryPathResolver(paths, mappings, legacy);

    private Product product(String legacyId) {
        var product = new Product();
        product.setId("product-1");
        product.setCategoryId(legacyId);
        return product;
    }

    @Test
    void primaryPathAlwaysWins() {
        when(paths.findById("product-1")).thenReturn(Optional.of(new ProductPrimaryCategoryPath("product-1", "node-new")));

        assertThat(resolver.resolve(product("rec-cat-old")))
                .isEqualTo(new ProductCategoryPathResolver.ResolvedCategory(ProductCategoryPathResolver.Source.PRIMARY_PATH, "node-new"));
        verifyNoInteractions(mappings, legacy);
    }

    @Test
    void recCategoryIdUsesExplicitOldToNewMapping() {
        when(paths.findById("product-1")).thenReturn(Optional.empty());
        when(mappings.findById("rec-cat-old")).thenReturn(Optional.of(new CategoryLegacyMapping("rec-cat-old", "node-new")));

        assertThat(resolver.resolve(product("rec-cat-old")))
                .isEqualTo(new ProductCategoryPathResolver.ResolvedCategory(ProductCategoryPathResolver.Source.LEGACY_MAPPING, "node-new"));
    }

    @Test
    void validUnmappedFlatCategoryRemainsReadable() {
        when(paths.findById("product-1")).thenReturn(Optional.empty());
        when(mappings.findById("cat-existing")).thenReturn(Optional.empty());
        when(legacy.existsById("cat-existing")).thenReturn(true);

        assertThat(resolver.resolve(product("cat-existing")))
                .isEqualTo(new ProductCategoryPathResolver.ResolvedCategory(ProductCategoryPathResolver.Source.LEGACY_FLAT, "cat-existing"));
    }

    @Test
    void absentOrUnknownLegacyCategoryFallsBackWithoutMutatingProduct() {
        var product = product("missing-category");
        when(paths.findById("product-1")).thenReturn(Optional.empty());
        when(mappings.findById("missing-category")).thenReturn(Optional.empty());
        when(legacy.existsById("missing-category")).thenReturn(false);

        assertThat(resolver.resolve(product))
                .isEqualTo(new ProductCategoryPathResolver.ResolvedCategory(ProductCategoryPathResolver.Source.UNCATEGORIZED, "system-uncategorized"));
        assertThat(product.getCategoryId()).isEqualTo("missing-category");
    }
}
