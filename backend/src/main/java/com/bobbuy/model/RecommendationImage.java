package com.bobbuy.model;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "bb_recommendation_image", uniqueConstraints = @UniqueConstraint(columnNames = {"merchant_id", "image_hash"}))
public class RecommendationImage {
    @Id public String id;
    @Column(nullable = false) public Long merchantId;
    @Column(nullable = false, length = 64) public String imageHash;
    @Column(nullable = false) public String contentType;
    @JdbcTypeCode(SqlTypes.VARBINARY) @Column(nullable = false, columnDefinition = "bytea") public byte[] content;
}
