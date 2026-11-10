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
    @Column(nullable=false,length=16) public String accessScope="PUBLIC";
    @JdbcTypeCode(SqlTypes.VARBINARY) @Column(columnDefinition = "bytea") public byte[] content;
    @Column(nullable=false,length=64) public String rawSha256;
    @Column(nullable=false) public long byteLength;
    @PrePersist @PreUpdate public void metadata(){
        if(content!=null){rawSha256=com.bobbuy.service.MediaBinaryService.sha(content);byteLength=content.length;}
        if(rawSha256==null||!rawSha256.matches("[0-9a-f]{64}")||byteLength<1)throw new IllegalStateException("Invalid media metadata");
    }
}
