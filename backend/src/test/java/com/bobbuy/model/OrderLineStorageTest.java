package com.bobbuy.model;

import com.bobbuy.config.OrderStorageJsonConfiguration;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class OrderLineStorageTest {
    private final ObjectMapper api=new ObjectMapper().findAndRegisterModules();
    private final ObjectMapper storage=OrderStorageJsonConfiguration.storageMapper();
    private final OrderLineStorageJavaType type=new OrderLineStorageJavaType();

    @Test void realStorageMixinReproducesLostSnapshotMetadataButSqlEqualityUsesOnlyStoredFields() throws Exception {
        var original=example();var raw=type.fromString(type.toString(List.of(original)));
        assertEquals(23,api.valueToTree(original).size());assertEquals(17,storage.valueToTree(original).size());
        assertInstanceOf(OrderLine.class,raw.get(0));assertNull(raw.get(0).getBrand());
        // Original failure: the actual storage mapper drops these fields from a JSON deep copy.
        assertNotEquals(original,raw.get(0));
        assertTrue(type.areEqual(List.of(original),raw));assertEquals(type.extractHashCode(List.of(original)),type.extractHashCode(raw));
        var snapshot=type.getMutabilityPlan().deepCopy(List.of(original));
        assertEquals(original,snapshot.get(0));assertNotSame(original,snapshot.get(0));
        assertEquals(List.of(original),type.getMutabilityPlan().assemble(type.getMutabilityPlan().disassemble(List.of(original),null),null));
        assertEquals(List.of(original),type.wrap(type.unwrap(List.of(original),List.class,null),null));
    }

    @Test void postLoadHydrationDoesNotDirtyLinesOrSidecar() throws Exception {
        var source=header(example());var sidecar=identities(source);
        var loaded=new OrderHeader();loaded.setLines(type.fromString(type.toString(source.getLines())));setIdentities(loaded,sidecar);
        var before=type.getMutabilityPlan().deepCopy(loaded.getLines());
        loaded.hydrateProductIdentities();
        assertEquals(source.getLines(),loaded.getLines());assertTrue(type.areEqual(before,loaded.getLines()));
        assertSame(sidecar,identities(loaded));
        assertEquals(23,api.valueToTree(loaded.getLines().get(0)).size(),"callbacks and owner must never appear in HTTP JSON");
    }

    @Test void allSeventeenPersistedFieldsStillDetectActualChanges() throws Exception {
        var line=example();ObjectNode original=storage.valueToTree(line);
        for(var fields=original.fieldNames();fields.hasNext();) {
            String field=fields.next();var changed=original.deepCopy();var value=changed.get(field);
            if(value.isObject())changed.putObject(field).put("different","value");
            else if(value.isBoolean())changed.put(field,!value.booleanValue());
            else if(value.isIntegralNumber())changed.put(field,value.longValue()+1);
            else if(value.isFloatingPointNumber())changed.put(field,value.decimalValue().add(BigDecimal.ONE));
            else changed.put(field,value.asText()+"-different");
            assertFalse(type.areEqual(List.of(line),List.of(storage.treeToValue(changed,OrderLine.class))),field);
        }
    }

    @Test void metadataOnlyEditsDirtySidecarAndClearsAreNotResurrected() throws Exception {
        var changes=List.<Consumer<OrderLine>>of(l->l.setBrand("B"),l->l.setItemNumber("N"),l->l.setModel("M2"),l->l.setPackaging("P2"),l->l.setSpecifications(Map.of("en-US","Changed")));
        for(var change:changes) {
            var header=header(example());var before=identities(header);var snapshot=type.getMutabilityPlan().deepCopy(header.getLines());
            change.accept(header.getLines().get(0));assertNotEquals(before,identities(header));assertTrue(type.areEqual(snapshot,header.getLines()));
            var reloaded=reload(header);assertEquals(header.getLines(),reloaded.getLines());
        }
        var header=header(example());var line=header.getLines().get(0);
        line.setBrand(null);line.setItemNumber(null);line.setModel(null);line.setPackaging(null);line.setSpecifications(Map.of());line.setSaleUnit(null);
        var reloaded=reload(header);assertNull(reloaded.getLines().get(0).getBrand());assertNull(reloaded.getLines().get(0).getSaleUnit());assertTrue(reloaded.getLines().get(0).getSpecifications().isEmpty());
        // Sale-unit facts must agree with the legacy spec used by the identity compatibility guard.
        var before=identities(header);line.setSaleUnit(line.getSpec());assertNotEquals(before,identities(header));assertEquals(line.getSpec(),reload(header).getLines().get(0).getSaleUnit());
        assertThrows(UnsupportedOperationException.class,()->line.getSpecifications().put("en-US","silent mutation"));
    }

    @Test void ownerCallbacksDoNotLeakAcrossHeadersOrRemovedLines() throws Exception {
        var first=header(example());var firstSidecar=identities(first);var shared=first.getLines().get(0);
        var second=new OrderHeader();second.setId(99L);second.addLine(shared);second.retainProductIdentities();
        assertNotSame(shared,second.getLines().get(0));second.getLines().get(0).setBrand("Second");
        assertEquals(firstSidecar,identities(first));assertEquals("Brand",first.getLines().get(0).getBrand());assertEquals("Second",second.getLines().get(0).getBrand());
        first.setLines(List.of());shared.setBrand("Removed");assertEquals(firstSidecar,identities(first));
        // Hibernate uses field access when merging a JSON value, bypassing setLines.
        var field=OrderHeader.class.getDeclaredField("lines");field.setAccessible(true);
        field.set(second,type.getMutabilityPlan().deepCopy(second.getLines()));
        var before=identities(second);second.getLines().get(0).setBrand("After merge");assertNotEquals(before,identities(second));
    }

    private OrderHeader reload(OrderHeader source) throws Exception {
        var result=new OrderHeader();result.setLines(type.fromString(type.toString(source.getLines())));setIdentities(result,new HashMap<>(identities(source)));result.hydrateProductIdentities();return result;
    }
    @SuppressWarnings("unchecked") private static Map<String,OrderLineIdentity> identities(OrderHeader header) throws Exception {var f=OrderHeader.class.getDeclaredField("productIdentities");f.setAccessible(true);return (Map<String,OrderLineIdentity>)f.get(header);}
    private static void setIdentities(OrderHeader header,Map<String,OrderLineIdentity> value) throws Exception {var f=OrderHeader.class.getDeclaredField("productIdentities");f.setAccessible(true);f.set(header,value);}
    private static OrderHeader header(OrderLine line){var result=new OrderHeader();result.setId(1L);result.addLine(line);result.retainProductIdentities();return result;}
    private static OrderLine example(){
        var line=new OrderLine("98e8de5e-2122-451b-89c8-693439d90b60","Synthetic","pack",2,12.5);
        line.setId(2L);line.setHeaderId(1L);line.setNames(Map.of("en-US","Synthetic"));line.setPurchasedQuantity(1);line.setPickingConfirmed(true);
        line.setCurrency("JPY");line.setPriceRevision(7);line.setQuotedAmount(new BigDecimal("12.50"));line.setRegularAmount(new BigDecimal("15.00"));line.setPriceAdjustmentId(3L);line.setPriceChannel("SYNTHETIC");line.setPricedAt(Instant.parse("2026-11-09T10:00:00Z"));
        line.setBrand("Brand");line.setItemNumber("21879");line.setModel("M");line.setPackaging("Box");line.setSaleUnit("pack");line.setSpecifications(Map.of("en-US","Synthetic specification"));return line;
    }
}
