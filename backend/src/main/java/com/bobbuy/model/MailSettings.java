package com.bobbuy.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity @Table(name="bb_mail_settings")
public class MailSettings {
 @Id public Integer id=1;
 @Version public long version;
 public boolean enabled;
 public String host="mail.briconbric.com";
 public int port=587;
 public String tlsMode="STARTTLS";
 public String username="postmaster@bobuy.cc";
 public String fromAddress="postmaster@bobuy.cc";
 public String replyTo="postmaster@bobuy.cc";
 @Column(columnDefinition="text") public String encryptedPassword;
 public String keyId;
 public Long updatedBy;
 public Instant updatedAt;
}
