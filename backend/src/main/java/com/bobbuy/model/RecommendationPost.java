package com.bobbuy.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "bb_recommendation_post")
public class RecommendationPost {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    @Column(nullable = false) public Long merchantId;
    @Column(nullable = false, length = 200) public String title = "";
    @Column(nullable = false, columnDefinition = "text") public String body = "";
    @Column(nullable = false) public boolean published;
    @Version public long version;
    @Column(nullable = false) public LocalDateTime createdAt = LocalDateTime.now();
    @Column(nullable = false) public LocalDateTime updatedAt = LocalDateTime.now();
    public java.time.Instant publishedAt;
    public Long publisherId;
    @Column(length = 255) public String publisherName;
}
