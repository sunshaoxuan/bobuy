package com.bobbuy.model;

import com.bobbuy.model.converter.OrderLineListJsonConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 订单头模型 - 代表一次业务层面的购买事件
 * 对齐设计文档: ARCH-11
 */
@Entity
@Table(
        name = "bb_order_header",
        uniqueConstraints = @UniqueConstraint(name = "uk_bb_order_header_business_id", columnNames = "business_id"))
public class OrderHeader {
    @Id
    private Long id; // 物理主键
    @Column(name = "business_id", nullable = false, length = 64)
    private String businessId; // 业务幂等标识 (Event ID)
    private Long customerId; // 客户 ID
    private Long tripId; // 行程 ID
    private String desiredDeliveryWindow; // 预订单期望收货窗口
    private LocalDateTime createdAt;
    @Enumerated(EnumType.STRING)
    private OrderStatus status; // 订单状态
    private LocalDateTime statusUpdatedAt;
    @Enumerated(EnumType.STRING)
    private PaymentMethod paymentMethod; // 支付方式
    @Enumerated(EnumType.STRING)
    private PaymentStatus paymentStatus; // 支付状态
    @com.fasterxml.jackson.annotation.JsonProperty(access=com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY)
    private String currency="JPY";
    public String getCurrency(){return currency;}
    public void setCurrency(String value){currency=value;}
    private double totalAmount; // 冗余汇总金额
    private LocalDateTime receiptConfirmedAt;
    private String receiptConfirmedBy;
    private LocalDateTime billingConfirmedAt;
    private String billingConfirmedBy;
    @Enumerated(EnumType.STRING)
    private DeliveryStatus deliveryStatus;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<OrderLine> lines = new ArrayList<>(); // 嵌套行条目

    public OrderHeader() {
    }

    public OrderHeader(String businessId, Long customerId, Long tripId) {
        this.businessId = businessId;
        this.customerId = customerId;
        this.tripId = tripId;
        this.createdAt = LocalDateTime.now();
        this.status = OrderStatus.NEW;
        this.statusUpdatedAt = LocalDateTime.now();
        this.paymentStatus = PaymentStatus.UNPAID;
        this.deliveryStatus = DeliveryStatus.PENDING_DELIVERY;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getBusinessId() {
        return businessId;
    }

    public void setBusinessId(String businessId) {
        this.businessId = businessId;
    }

    public Long getCustomerId() {
        return customerId;
    }

    public void setCustomerId(Long customerId) {
        this.customerId = customerId;
    }

    public Long getTripId() {
        return tripId;
    }

    public void setTripId(Long tripId) {
        this.tripId = tripId;
    }

    public String getDesiredDeliveryWindow() {
        return desiredDeliveryWindow;
    }

    public void setDesiredDeliveryWindow(String desiredDeliveryWindow) {
        this.desiredDeliveryWindow = desiredDeliveryWindow;
    }

    public OrderStatus getStatus() {
        return status;
    }

    public void setStatus(OrderStatus status) {
        this.status = status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getStatusUpdatedAt() {
        return statusUpdatedAt;
    }

    public void setStatusUpdatedAt(LocalDateTime statusUpdatedAt) {
        this.statusUpdatedAt = statusUpdatedAt;
    }

    public PaymentMethod getPaymentMethod() {
        return paymentMethod;
    }

    public void setPaymentMethod(PaymentMethod paymentMethod) {
        this.paymentMethod = paymentMethod;
    }

    public PaymentStatus getPaymentStatus() {
        return paymentStatus;
    }

    public void setPaymentStatus(PaymentStatus paymentStatus) {
        this.paymentStatus = paymentStatus;
    }

    public double getTotalAmount() {
        return totalAmount;
    }

    public void setTotalAmount(double totalAmount) {
        this.totalAmount = totalAmount;
    }

    public List<OrderLine> getLines() {
        return lines;
    }

    public void setLines(List<OrderLine> lines) {
        this.lines = lines;
    }

    public void addLine(OrderLine line) {
        this.lines.add(line);
        line.setHeaderId(this.id);
    }

    public LocalDateTime getReceiptConfirmedAt() {
        return receiptConfirmedAt;
    }

    public void setReceiptConfirmedAt(LocalDateTime receiptConfirmedAt) {
        this.receiptConfirmedAt = receiptConfirmedAt;
    }

    public String getReceiptConfirmedBy() {
        return receiptConfirmedBy;
    }

    public void setReceiptConfirmedBy(String receiptConfirmedBy) {
        this.receiptConfirmedBy = receiptConfirmedBy;
    }

    public LocalDateTime getBillingConfirmedAt() {
        return billingConfirmedAt;
    }

    public void setBillingConfirmedAt(LocalDateTime billingConfirmedAt) {
        this.billingConfirmedAt = billingConfirmedAt;
    }

    public String getBillingConfirmedBy() {
        return billingConfirmedBy;
    }

    public void setBillingConfirmedBy(String billingConfirmedBy) {
        this.billingConfirmedBy = billingConfirmedBy;
    }

    public DeliveryStatus getDeliveryStatus() {
        return deliveryStatus;
    }

    public void setDeliveryStatus(DeliveryStatus deliveryStatus) {
        this.deliveryStatus = deliveryStatus;
    }
}
