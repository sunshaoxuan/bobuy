package com.bobbuy.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "bb_product_primary_category_path")
public class ProductPrimaryCategoryPath {
    @Id
    @Column(name = "product_id")
    private String productId;
    @Column(name = "category_node_id", nullable = false)
    private String categoryNodeId;

    public ProductPrimaryCategoryPath() {}
    public ProductPrimaryCategoryPath(String productId, String categoryNodeId) {
        this.productId = productId;
        this.categoryNodeId = categoryNodeId;
    }
    public String getProductId() { return productId; }
    public void setProductId(String value) { productId = value; }
    public String getCategoryNodeId() { return categoryNodeId; }
    public void setCategoryNodeId(String value) { categoryNodeId = value; }
}
