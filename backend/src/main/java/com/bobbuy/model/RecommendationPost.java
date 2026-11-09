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
    @Column(length=10) public String articleSourceLocale;
    public record ArticleText(String title,String body,String sourceHash,java.time.Instant reviewedAt) {}
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    @Column(columnDefinition="jsonb",nullable=false)
    public java.util.Map<String,ArticleText> articleTranslations=new java.util.HashMap<>();
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    @Column(columnDefinition="jsonb") public RecommendationServiceOffer serviceOffer;
    @Column(length=64) public String serviceSourceKey;
    @Column(nullable = false) public boolean published;
    @Version public long version;
    @Column(nullable = false) public LocalDateTime createdAt = LocalDateTime.now();
    @Column(nullable = false) public LocalDateTime updatedAt = LocalDateTime.now();
    public java.time.Instant publishedAt;
    public Long publisherId;
    @Column(length = 255) public String publisherName;
    public java.time.LocalDate issueDate;
    @Column(length = 2048) public String issueDateSourceRef;
    @Column(length = 64) public String issueDateSourceHash;
    public Long issueDateReviewedBy;
    public java.time.Instant issueDateReviewedAt;

    /** A publication/edit timestamp or a partially populated review is never an issue date. */
    public boolean hasReviewedIssueDate() {
        return issueDate!=null&&issueDateSourceRef!=null&&!issueDateSourceRef.isBlank()
            &&issueDateSourceHash!=null&&issueDateSourceHash.matches("[0-9a-f]{64}")
            &&issueDateReviewedBy!=null&&issueDateReviewedBy>0&&issueDateReviewedAt!=null;
    }
    public java.time.LocalDate reviewedIssueDate(){return hasReviewedIssueDate()?issueDate:null;}
    public String issueDateSource(){return hasReviewedIssueDate()?"REVIEWED_SOURCE":"UNKNOWN";}
}
