package com.bobbuy.model;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.Map;
@Entity @org.hibernate.annotations.Immutable
@Table(name="bb_recommendation_article_revision")
public class RecommendationArticleRevision {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
 public Long merchantId; public Long postId;
 @Column(length=64,nullable=false) public String factsHash;
 @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition="jsonb",nullable=false) public Map<String,Object> facts;
 public Instant recordedAt;
 @PreUpdate @PreRemove void retained(){throw new IllegalStateException("Article revisions are retained");}
}
