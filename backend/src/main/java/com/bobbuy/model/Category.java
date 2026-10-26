package com.bobbuy.model;

import com.bobbuy.model.converter.CategoryAttributeDefinitionsJsonConverter;
import com.bobbuy.model.converter.StringMapJsonConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
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
@Table(name = "bb_category")
public class Category {
    private Long merchantId;
    public Long getMerchantId() { return merchantId; }
    public void setMerchantId(Long value) { merchantId = value; }
    @Column(length=100) private String tagKey;
    public String getTagKey() { return tagKey; }
    public void setTagKey(String value) { tagKey = value; }
    @Id
    private String id;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, String> name = new HashMap<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, String> description = new HashMap<>();

    @JsonbColumn
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "attribute_template", columnDefinition = "jsonb")
    private List<Map<String, Object>> attributeTemplate = new ArrayList<>();

    public Category() {
    }

    public Category(String id,
                    Map<String, String> name,
                    Map<String, String> description,
                    List<Map<String, Object>> attributeTemplate) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.attributeTemplate = attributeTemplate;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public Map<String, String> getName() {
        return name;
    }

    public void setName(Map<String, String> name) {
        this.name = name;
    }

    public Map<String, String> getDescription() {
        return description;
    }

    public void setDescription(Map<String, String> description) {
        this.description = description;
    }

    public List<Map<String, Object>> getAttributeTemplate() {
        return attributeTemplate;
    }

    public void setAttributeTemplate(List<Map<String, Object>> attributeTemplate) {
        this.attributeTemplate = attributeTemplate;
    }
}
