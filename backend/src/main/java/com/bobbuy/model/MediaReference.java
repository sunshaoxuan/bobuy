package com.bobbuy.model;
import jakarta.persistence.*;
/** A retained media identity is a retention root, even if its product is logically deleted. */
@Entity @Table(name="bb_media_reference")
public class MediaReference {
 @Id @Column(name="image_id",length=255) public String imageId;
 @Column(name="blob_sha256",nullable=false,length=64) public String blobSha256;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="image_id",insertable=false,updatable=false)
 @org.hibernate.annotations.OnDelete(action=org.hibernate.annotations.OnDeleteAction.CASCADE)
 public RecommendationImage image;
 @ManyToOne(fetch=FetchType.LAZY) @JoinColumn(name="blob_sha256",insertable=false,updatable=false)
 public MediaBlob blob;
}
