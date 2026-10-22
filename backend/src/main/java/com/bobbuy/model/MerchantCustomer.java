package com.bobbuy.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "bb_merchant_customer", uniqueConstraints = @UniqueConstraint(columnNames = {"merchant_id", "customer_id"}))
public class MerchantCustomer {
    @Id public String id;
    @Column(nullable = false) public Long merchantId;
    @Column(nullable = false) public Long customerId;
    public Instant approvedAt;
    public Long approvedBy;
}
