package com.bobbuy.model;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class OrderLineValueTest {
    private final ObjectMapper json = new ObjectMapper().findAndRegisterModules();

    @Test void jsonSnapshotEqualsOriginalIncludingPriceAndIdentity() throws Exception {
        var line = example();
        var copy = copy(line);
        assertNotSame(line, copy);
        assertEquals(line, copy);
        assertEquals(line.hashCode(), copy.hashCode());
        assertEquals(List.of(line), List.of(copy));
    }

    @Test void everyPersistedLineFieldParticipatesInDirtyChecking() throws Exception {
        var line = example();
        // Exercise all serialized fields, rather than only quantities or metadata.
        com.fasterxml.jackson.databind.node.ObjectNode original = json.valueToTree(line);
        assertEquals(23, original.size());
        for (var fields = original.fieldNames(); fields.hasNext();) {
            var field = fields.next();
            var changed = original.deepCopy();
            var value = changed.get(field);
            if (value.isObject()) changed.putObject(field).put("different", "value");
            else if (value.isBoolean()) changed.put(field, !value.booleanValue());
            else if (value.isIntegralNumber()) changed.put(field, value.longValue() + 1);
            else if (value.isFloatingPointNumber()) changed.put(field, value.decimalValue().add(BigDecimal.ONE));
            else if (field.equals("pricedAt")) changed.put(field, "2026-11-10T10:00:00Z");
            else changed.put(field, value.asText() + "-different");
            assertNotEquals(line, json.treeToValue(changed, OrderLine.class), field);
        }
    }

    @Test void equalJsonSnapshotsStillDetectInPlaceQuantityChanges() throws Exception {
        var line = example();
        var snapshot = copy(line);
        line.setQuantity(line.getQuantity() + 1);
        assertNotEquals(List.of(snapshot), List.of(line));
        assertFalse(line.equals(null));
        assertFalse(line.equals("not a line"));
    }

    private OrderLine copy(OrderLine line) throws Exception {
        return json.readValue(json.writeValueAsBytes(line), OrderLine.class);
    }
    private static OrderLine example() {
        var line = new OrderLine("98e8de5e-2122-451b-89c8-693439d90b60", "Synthetic", "pack", 2, 12.5);
        line.setId(2L); line.setHeaderId(1L); line.setNames(Map.of("en-US", "Synthetic"));
        line.setPurchasedQuantity(1); line.setPickingConfirmed(true); line.setCurrency("JPY");
        line.setPriceRevision(7); line.setQuotedAmount(new BigDecimal("12.50"));
        line.setRegularAmount(new BigDecimal("15.00")); line.setPriceAdjustmentId(3L);
        line.setPriceChannel("SYNTHETIC"); line.setPricedAt(Instant.parse("2026-11-09T10:00:00Z"));
        line.setBrand("Brand"); line.setItemNumber("21879"); line.setModel("M");
        line.setPackaging("Box"); line.setSaleUnit("pack"); line.setSpecifications(Map.of("en-US", "Long synthetic specification"));
        return line;
    }
}
