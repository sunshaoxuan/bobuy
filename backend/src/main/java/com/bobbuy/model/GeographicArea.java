package com.bobbuy.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.Immutable;

/** Versioned reference data. Changes are delivered through Flyway migrations. */
@Entity
@Immutable
@Table(name = "bb_geographic_area")
public class GeographicArea {
    @Id private String code;
    private String parentCode;
    private int level;
    private String name;
    private String reading;

    protected GeographicArea() {}
    public String getCode() { return code; }
    public String getParentCode() { return parentCode; }
    public int getLevel() { return level; }
    public String getName() { return name; }
    public String getReading() { return reading; }
}
