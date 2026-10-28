package com.bobbuy.model;
import jakarta.persistence.*;
import java.time.Instant;
@Entity @Table(name="bb_media_blob")
public class MediaBlob {
 @Id @Column(length=64) public String sha256;
 @Column(nullable=false) public long byteLength;
 @Column(nullable=false,length=255) public String contentType;
 public Instant busyUntil;
 public Instant gcCandidateAt;
 @Version public Long version;
}
