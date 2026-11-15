package com.bobbuy.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "bb_category_legacy_mapping")
public class CategoryLegacyMapping {
    @Id
    @Column(name = "legacy_category_id")
    private String legacyCategoryId;
    @Column(name = "category_node_id", nullable = false)
    private String categoryNodeId;

    public CategoryLegacyMapping() {}
    public CategoryLegacyMapping(String legacyCategoryId, String categoryNodeId) {
        this.legacyCategoryId = legacyCategoryId;
        this.categoryNodeId = categoryNodeId;
    }
    public String getLegacyCategoryId() { return legacyCategoryId; }
    public void setLegacyCategoryId(String value) { legacyCategoryId = value; }
    public String getCategoryNodeId() { return categoryNodeId; }
    public void setCategoryNodeId(String value) { categoryNodeId = value; }
}
