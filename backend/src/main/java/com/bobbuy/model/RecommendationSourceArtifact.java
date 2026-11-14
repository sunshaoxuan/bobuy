package com.bobbuy.model;

import jakarta.persistence.*;
import java.time.Instant;

/** Private, immutable source evidence. Content must never be projected by a public API. */
@Entity @Table(name="bb_recommendation_source_artifact")
public class RecommendationSourceArtifact {
    @Id @Column(length=64) public String sha256;
    @Column(nullable=false,length=2048,unique=true) public String sourceRef;
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.VARBINARY)
    @Column(nullable=false,columnDefinition="bytea") public byte[] content;
    @Column(nullable=false,length=255) public String contentType;
    @Column(nullable=false) public long byteLength;
    @Column(nullable=false,length=64) public String algorithm;
    @Column(nullable=false) public Instant acquiredAt;
}
