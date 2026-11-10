package com.bobbuy.service;

import com.bobbuy.api.CustomerOrderAmendmentRequest;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static com.bobbuy.service.CustomerOrderAmendmentPolicy.*;

class CustomerOrderAmendmentPolicyTest {
    private final String revision = "a".repeat(64);
    private final LocalDate today = LocalDate.of(2026, 11, 9);
    private Snapshot snapshot(String status, String payment, String delivery, String trip, int purchased,
            boolean frozen, boolean picking, boolean receipt, boolean billing) {
        return new Snapshot(2L, revision, status, payment, delivery, trip, today.plusDays(1), frozen, purchased, picking, receipt, billing);
    }
    private Snapshot normal() { return snapshot("NEW", "UNPAID", "PENDING_DELIVERY", "PUBLISHED", 0, false, false, false, false); }
    @Test void ownUncommittedOrderOnlyAndRevisionConflict() {
        assertTrue(checkRevision(2L, normal(), today, revision).editable());
        assertEquals(Reason.REVISION_CONFLICT, checkRevision(2L, normal(), today, "b".repeat(64)).reason());
        assertNull(evaluate(3L, normal(), today).currentRevision());
        assertFalse(evaluate(null, normal(), today).editable());
        assertEquals(Reason.NOT_FOUND, evaluate(2L, null, today).reason());
    }
    @Test void statusPaymentAndFulfillmentMatrixNeverAllowsFundsOrProcurementChanges() {
        for (var status : List.of("CONFIRMED", "PURCHASED", "DELIVERED", "SETTLED", "CANCELLED", "future"))
            assertFalse(evaluate(2L, snapshot(status, "UNPAID", "PENDING_DELIVERY", "PUBLISHED", 0, false, false, false, false), today).editable());
        for (var payment : List.of("PAID", "REFUNDED", "", "future"))
            assertFalse(evaluate(2L, snapshot("NEW", payment, "PENDING_DELIVERY", "PUBLISHED", 0, false, false, false, false), today).editable());
        for (var delivery : List.of("READY_FOR_DELIVERY", "DELIVERING", "DELIVERED"))
            assertFalse(evaluate(2L, snapshot("NEW", "UNPAID", delivery, "PUBLISHED", 0, false, false, false, false), today).editable());
        assertFalse(evaluate(2L, snapshot("NEW", "UNPAID", "PENDING_DELIVERY", "PUBLISHED", 1, false, false, false, false), today).editable());
        assertFalse(evaluate(2L, snapshot("NEW", "UNPAID", "PENDING_DELIVERY", "PUBLISHED", 0, false, true, false, false), today).editable());
        assertFalse(evaluate(2L, snapshot("NEW", "UNPAID", "PENDING_DELIVERY", "PUBLISHED", 0, true, false, false, false), today).editable());
        assertFalse(evaluate(2L, snapshot("NEW", "UNPAID", "PENDING_DELIVERY", "PUBLISHED", 0, false, false, true, false), today).editable());
        assertFalse(evaluate(2L, snapshot("NEW", "UNPAID", "PENDING_DELIVERY", "PUBLISHED", 0, false, false, false, true), today).editable());
        assertFalse(evaluate(2L, normal(), today.plusDays(2)).editable());
    }
    @Test void rejectsPrivilegeFieldsEvenWithUnknownPropertiesGloballyIgnored() {
        var mapper = new ObjectMapper().disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
        var base = "{\"requestId\":\"00000000-0000-0000-0000-000000000001\",\"expectedRevision\":\"" + revision + "\",\"lines\":[{\"productId\":\"98e8de5e-2122-451b-89c8-693439d90b60\",\"quantity\":2}]";
        for (var key : List.of("customerId", "status", "paymentStatus", "totalAmount", "merchantId"))
            assertThrows(Exception.class, () -> mapper.readValue(base + ",\"" + key + "\":1}", CustomerOrderAmendmentRequest.class));
        assertThrows(Exception.class, () -> mapper.readValue(base.replace("\"quantity\":2", "\"quantity\":2,\"price\":1") + "}", CustomerOrderAmendmentRequest.class));
        assertThrows(Exception.class, () -> mapper.readValue(base.replace("\"quantity\":2", "\"quantity\":1.5") + "}", CustomerOrderAmendmentRequest.class));
        assertThrows(Exception.class, () -> mapper.readValue(base.replace("\"98e8de5e-2122-451b-89c8-693439d90b60\"", "1") + "}", CustomerOrderAmendmentRequest.class));
        var parsed = assertDoesNotThrow(() -> mapper.readValue(base + "}", CustomerOrderAmendmentRequest.class));
        assertEquals("98e8de5e-2122-451b-89c8-693439d90b60", parsed.lines().get(0).productId());
        var delivery = ",\"delivery\":{\"contactName\":\" A \",\"countryRegion\":\"JP\",\"city\":\"Tokyo\",\"addressLine\":\"Street\"}";
        var valid = assertDoesNotThrow(() -> mapper.readValue(base + delivery + "}", CustomerOrderAmendmentRequest.class));
        assertEquals("A", valid.delivery().contactName());
        assertThrows(Exception.class, () -> mapper.readValue(base + delivery.replace("\"JP\"", "\"JP\",\"verified\":true") + "}", CustomerOrderAmendmentRequest.class));
        assertThrows(Exception.class, () -> mapper.readValue(base + delivery.replace("\"Street\"", "\" \"") + "}", CustomerOrderAmendmentRequest.class));
    }
    @Test void fingerprintCanonicalizesLinesButBindsIdentityRevisionAndDeliveryIntent() {
        var one = new CustomerOrderAmendmentRequest.Line("98e8de5e-2122-451b-89c8-693439d90b60", 2);
        var two = new CustomerOrderAmendmentRequest.Line("legacy:SKU-001", 3);
        var a = new CustomerOrderAmendmentRequest("00000000-0000-0000-0000-000000000001", revision, List.of(one, two), null);
        var b = new CustomerOrderAmendmentRequest("00000000-0000-0000-0000-000000000002", revision, List.of(two, one), null);
        assertEquals(CustomerOrderAmendmentFingerprint.of(2, 4, a), CustomerOrderAmendmentFingerprint.of(2, 4, b));
        assertNotEquals(CustomerOrderAmendmentFingerprint.of(2, 4, a), CustomerOrderAmendmentFingerprint.of(3, 4, a));
        assertThrows(IllegalArgumentException.class, () -> new CustomerOrderAmendmentRequest(a.requestId(), revision, List.of(one, one), null));
        var changed = new CustomerOrderAmendmentRequest(a.requestId(), "b".repeat(64), a.lines(), null);
        assertNotEquals(CustomerOrderAmendmentFingerprint.of(2, 4, a), CustomerOrderAmendmentFingerprint.of(2, 4, changed));
        var destination = new CustomerOrderAmendmentRequest.Delivery("A", null, "JP", "Tokyo", "Street", null);
        var withDelivery = new CustomerOrderAmendmentRequest(a.requestId(), revision, a.lines(), destination);
        assertNotEquals(CustomerOrderAmendmentFingerprint.of(2, 4, a), CustomerOrderAmendmentFingerprint.of(2, 4, withDelivery));
        assertEquals("x".repeat(255), new CustomerOrderAmendmentRequest.Line("x".repeat(255), 1).productId());
        for (var invalidId : List.of("", " \t\n", "x".repeat(256)))
            assertThrows(IllegalArgumentException.class, () -> new CustomerOrderAmendmentRequest.Line(invalidId, 1));
        assertThrows(IllegalArgumentException.class, () -> new CustomerOrderAmendmentRequest.Line(null, 1));
        var otherProduct = new CustomerOrderAmendmentRequest(a.requestId(), revision,
                List.of(new CustomerOrderAmendmentRequest.Line("different-string-id", 2), two), null);
        assertNotEquals(CustomerOrderAmendmentFingerprint.of(2, 4, a), CustomerOrderAmendmentFingerprint.of(2, 4, otherProduct));
        var quoted=new CustomerOrderAmendmentRequest(a.requestId(),revision,List.of(new CustomerOrderAmendmentRequest.Line(one.productId(),2,"quote-one",1L,"JPY"),two),null);
        assertNotEquals(CustomerOrderAmendmentFingerprint.of(2,4,a),CustomerOrderAmendmentFingerprint.of(2,4,quoted));
    }
}
