package com.bobbuy.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.Map;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** Immutable historical label, deliberately excluded from active classification choices. */
@Entity @Table(name="bb_retired_category")
public class RetiredCategory {
 @Id public String id;
 @Column(nullable=false) public Long merchantId;
 public String tagKey;
 @JdbcTypeCode(SqlTypes.JSON) @Column(nullable=false,columnDefinition="jsonb") public Map<String,String> name;
 @JdbcTypeCode(SqlTypes.JSON) @Column(nullable=false,columnDefinition="jsonb") public Map<String,Object> original;
 @Column(nullable=false,length=64) public String operationId;
 @Column(nullable=false) public Instant retiredAt;
}
