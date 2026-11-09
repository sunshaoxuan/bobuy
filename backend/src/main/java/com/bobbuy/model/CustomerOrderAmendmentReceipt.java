package com.bobbuy.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** Private immutable history and replay receipt. Never bound from a request or returned directly. */
@Entity
@org.hibernate.annotations.Immutable
@Table(name="bb_customer_order_amendment",uniqueConstraints=@UniqueConstraint(name="uk_customer_order_amendment_request",columnNames={"customer_id","request_id"}))
public class CustomerOrderAmendmentReceipt {
    @Id @Column(length=128) public String id;
    @Column(name="customer_id",nullable=false) public Long customerId;
    @Column(name="request_id",nullable=false,length=36) public String requestId;
    @Column(name="order_id",nullable=false) public Long orderId;
    @Column(name="payload_hash",nullable=false,length=64) public String payloadHash;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name="original_order",columnDefinition="jsonb",nullable=false) public com.fasterxml.jackson.databind.JsonNode originalOrder;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name="result_view",columnDefinition="jsonb",nullable=false) public com.fasterxml.jackson.databind.JsonNode resultView;
    @Column(name="created_at",nullable=false) public LocalDateTime createdAt;
}
