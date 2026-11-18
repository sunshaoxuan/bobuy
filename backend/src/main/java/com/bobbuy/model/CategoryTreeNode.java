package com.bobbuy.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "bb_category_tree_node")
public class CategoryTreeNode {
    @Id
    private String id;
    @Column(name = "parent_id")
    private String parentId;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private Map<String, String> name = new HashMap<>();
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "full_path", columnDefinition = "jsonb", nullable = false)
    private List<String> fullPath = new ArrayList<>();
    @Column(name = "sort_order", nullable = false)
    private int sortOrder;
    @Column(name = "explicit_order", nullable = false)
    private boolean explicitOrder;
    @Column(name = "system_key", length = 64)
    private String systemKey;

    @Column(name = "image_url", length = 512)
    private String imageUrl;
    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String value) { imageUrl = value; }

    public CategoryTreeNode() {}

    public CategoryTreeNode(String id, String parentId, Map<String, String> name,
                            List<String> fullPath, int sortOrder, String systemKey) {
        this.id = id;
        this.parentId = parentId;
        this.name = name;
        this.fullPath = fullPath;
        this.sortOrder = sortOrder;
        this.systemKey = systemKey;
    }

    public String getId() { return id; }
    public void setId(String value) { id = value; }
    public String getParentId() { return parentId; }
    public void setParentId(String value) { parentId = value; }
    public Map<String, String> getName() { return name; }
    public void setName(Map<String, String> value) { name = value; }
    public List<String> getFullPath() { return fullPath; }
    public void setFullPath(List<String> value) { fullPath = value; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int value) { sortOrder = value; }
    public boolean isExplicitOrder() { return explicitOrder; }
    public void setExplicitOrder(boolean value) { explicitOrder = value; }
    public String getSystemKey() { return systemKey; }
    public void setSystemKey(String value) { systemKey = value; }
}
