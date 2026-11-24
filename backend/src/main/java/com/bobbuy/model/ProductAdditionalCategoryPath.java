package com.bobbuy.model;

import jakarta.persistence.*;
import java.io.Serializable;
import java.util.Objects;

@Entity
@Table(name = "bb_product_additional_category_path")
@IdClass(ProductAdditionalCategoryPath.Key.class)
public class ProductAdditionalCategoryPath {
    @Id @Column(name = "product_id") private String productId;
    @Id @Column(name = "category_node_id") private String categoryNodeId;

    public ProductAdditionalCategoryPath() {}
    public ProductAdditionalCategoryPath(String productId, String categoryNodeId) { this.productId = productId; this.categoryNodeId = categoryNodeId; }
    public String getProductId() { return productId; }
    public String getCategoryNodeId() { return categoryNodeId; }

    public static class Key implements Serializable {
        public String productId; public String categoryNodeId;
        public Key() {}
        public Key(String productId, String categoryNodeId) { this.productId = productId; this.categoryNodeId = categoryNodeId; }
        @Override public boolean equals(Object value) { return value instanceof Key key && Objects.equals(productId, key.productId) && Objects.equals(categoryNodeId, key.categoryNodeId); }
        @Override public int hashCode() { return Objects.hash(productId, categoryNodeId); }
    }
}
