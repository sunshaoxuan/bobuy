package com.bobbuy.model;
import jakarta.persistence.*;
import java.time.Instant;

@Entity @Table(name="bb_media_transfer")
public class MediaTransfer {
 @Id @Column(name="image_id",length=255) public String imageId;
 @Column(nullable=false,length=64) public String rawSha256;
 @Column(nullable=false,length=600) public String objectKey;
 @Column(nullable=false) public long byteLength;
 @Column(nullable=false,length=255) public String contentType;
 @Column(nullable=false,length=16) public String state="PENDING";
 @Column(nullable=false) public int attempts;
 @Column(length=36) public String leaseToken;
 public Instant leaseUntil;
 public Instant verifiedAt;
 @Column(nullable=false) public Instant updatedAt=Instant.now();
 @Version public Long version;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="image_id",insertable=false,updatable=false)
 @org.hibernate.annotations.OnDelete(action=org.hibernate.annotations.OnDeleteAction.CASCADE)
 public RecommendationImage image;
}
