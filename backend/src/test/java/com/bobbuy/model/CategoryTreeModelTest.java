package com.bobbuy.model;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class CategoryTreeModelTest {
    @Test
    void nodeCarriesParentOrderingAndCompletePath() {
        var node = new CategoryTreeNode("node-child", "node-root",
                Map.of("ja-JP", "日本語名"), List.of("node-root", "node-child"), 20, null);

        assertThat(node.getParentId()).isEqualTo("node-root");
        assertThat(node.getFullPath()).containsExactly("node-root", "node-child");
        assertThat(node.getSortOrder()).isEqualTo(20);
        assertThat(node.getName()).containsEntry("ja-JP", "日本語名");
    }

    @Test
    void productKeyMakesThePrimaryPathSingularAndMappingRetainsLegacyId() {
        var path = new ProductPrimaryCategoryPath("product-1", "node-child");
        var mapping = new CategoryLegacyMapping("rec-cat-existing", "node-child");

        assertThat(path.getProductId()).isEqualTo("product-1");
        assertThat(path.getCategoryNodeId()).isEqualTo("node-child");
        assertThat(mapping.getLegacyCategoryId()).isEqualTo("rec-cat-existing");
        assertThat(mapping.getCategoryNodeId()).isEqualTo("node-child");
    }
}
