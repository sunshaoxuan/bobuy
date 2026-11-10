package com.bobbuy.model;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.Map;

/** Append-only audit snapshots survive item unlinking and logical deletion. */
@Entity @org.hibernate.annotations.Immutable
@Table(name="bb_reference_quote_revision")
public class ReferenceQuoteRevision {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
 @Column(nullable=false) public Long merchantId;
 @Column(nullable=false) public Long postId;
 @Column(nullable=false) public Long itemId;
 public String productId;
 @Column(nullable=false,length=64) public String factsHash;
 @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
 @Column(nullable=false,columnDefinition="jsonb") public Map<String,Object> facts;
 @Column(nullable=false) public Instant recordedAt;
 @PreUpdate @PreRemove void immutable(){throw new IllegalStateException("Reference quote revisions are immutable");}
}
