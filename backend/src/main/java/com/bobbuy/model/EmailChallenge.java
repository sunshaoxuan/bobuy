package com.bobbuy.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "bb_email_challenge")
public class EmailChallenge {
    @Id public Long userId;
    @Column(nullable = false) public String codeHash;
    @Column(nullable = false) public Instant expiresAt;
    @Column(nullable = false) public Instant sentAt;
    public int attempts;
}
