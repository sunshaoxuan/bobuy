package com.bobbuy.service;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class CheckoutFingerprintTest {
    private StorefrontService.Item item(String id,int qty,String token) { return new StorefrontService.Item(id,qty,1L,"JPY",token); }
    private StorefrontService.Checkout request(List<StorefrontService.Item> items) { return new StorefrontService.Checkout(UUID.randomUUID(),2000L,items,"JPY"); }
    @Test void canonicalAcrossRequestIdsLineOrderAndEquivalentAggregatedQuantities() {
        assertThat(CheckoutFingerprint.of(request(List.of(item("a",1,"a"),item("b",2,"b"),item("a",2,"a")))))
            .isEqualTo(CheckoutFingerprint.of(request(List.of(item("b",2,"b"),item("a",3,"a")))));
    }
    @Test void sameQuantityWithChangedQuoteIsDifferentAndAmbiguousDuplicateQuotesAreRejected() {
        assertThat(CheckoutFingerprint.of(request(List.of(item("a",1,"old")))))
            .isNotEqualTo(CheckoutFingerprint.of(request(List.of(item("a",1,"new")))));
        assertThatThrownBy(()->CheckoutFingerprint.of(request(List.of(item("a",1,"old"),item("a",1,"new"))))).hasMessage("checkout.request_conflict");
        assertThatThrownBy(()->CheckoutFingerprint.of(request(List.of(item("a",99,"old"),item("a",1,"old"))))).hasMessage("checkout.request_conflict");
    }
}
