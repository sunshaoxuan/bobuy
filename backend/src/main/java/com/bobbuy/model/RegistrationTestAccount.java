package com.bobbuy.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Database-owned provenance for the current registration acceptance run. */
@Entity
@Table(name = "bb_registration_test_account")
public class RegistrationTestAccount {
    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(nullable = false, length = 40)
    private String username;

    @Column(nullable = false, length = 254)
    private String email;

    protected RegistrationTestAccount() {}
}
