package com.bobbuy.service;

import java.time.LocalDate;
import java.util.Objects;

/** Pure admission policy. Invoke with a fresh, locked server snapshot, never request fields. */
public final class CustomerOrderAmendmentPolicy {
    private CustomerOrderAmendmentPolicy() {}
    public enum Reason { EDITABLE, NOT_FOUND, NOT_OWNER, UNKNOWN_STATE, CONTACT_MERCHANT,
        PAYMENT_LOCKED, ORDER_CLOSED, PROCUREMENT_STARTED, FULFILLMENT_STARTED,
        SETTLEMENT_LOCKED, TRIP_CLOSED, REVISION_CONFLICT }
    public record Snapshot(Long customerId, String revision, String status, String paymentStatus,
            String deliveryStatus, String tripStatus, LocalDate deliveryDate,
            boolean settlementFrozen, int purchasedQuantity, boolean pickingConfirmed,
            boolean receiptConfirmed, boolean billingConfirmed) {}
    public record Decision(boolean editable, Reason reason, String currentRevision) {}

    public static Decision evaluate(Long authenticatedCustomerId, Snapshot order, LocalDate today) {
        if (order == null) return deny(Reason.NOT_FOUND, null);
        if (authenticatedCustomerId == null || authenticatedCustomerId <= 0
                || !Objects.equals(authenticatedCustomerId, order.customerId()))
            return deny(Reason.NOT_OWNER, null); // Do not disclose another customer's revision.
        String revision = order.revision();
        if (revision == null || !revision.matches("[0-9a-f]{64}") || today == null
                || order.purchasedQuantity() < 0 || order.status() == null
                || order.paymentStatus() == null || order.deliveryStatus() == null
                || order.tripStatus() == null || order.deliveryDate() == null)
            return deny(Reason.UNKNOWN_STATE, revision);
        if (!"UNPAID".equals(order.paymentStatus())) return deny(Reason.PAYMENT_LOCKED, revision);
        if ("CONFIRMED".equals(order.status())) return deny(Reason.CONTACT_MERCHANT, revision);
        if (!"NEW".equals(order.status())) return deny(Reason.ORDER_CLOSED, revision);
        if (order.settlementFrozen() || order.receiptConfirmed() || order.billingConfirmed())
            return deny(Reason.SETTLEMENT_LOCKED, revision);
        if (order.purchasedQuantity() != 0 || order.pickingConfirmed())
            return deny(Reason.PROCUREMENT_STARTED, revision);
        if (!"PENDING_DELIVERY".equals(order.deliveryStatus()))
            return deny(Reason.FULFILLMENT_STARTED, revision);
        if (!"PUBLISHED".equals(order.tripStatus()) || order.deliveryDate().isBefore(today))
            return deny(Reason.TRIP_CLOSED, revision);
        return new Decision(true, Reason.EDITABLE, revision);
    }
    public static Decision checkRevision(Long customerId, Snapshot order, LocalDate today, String expected) {
        Decision admission = evaluate(customerId, order, today);
        if (!admission.editable()) return admission;
        return Objects.equals(expected, admission.currentRevision()) ? admission
                : deny(Reason.REVISION_CONFLICT, admission.currentRevision());
    }
    private static Decision deny(Reason reason, String revision) { return new Decision(false, reason, revision); }
}
