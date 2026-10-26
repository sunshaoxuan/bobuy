package com.bobbuy.service;

import com.bobbuy.api.BobbuyApplication;
import com.bobbuy.model.*;
import com.bobbuy.repository.ProcurementReceiptRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.util.ReflectionTestUtils;
import static org.assertj.core.api.Assertions.*;

/** Regression checks for shared acceptance fixtures and the catalog-to-order path. */
@SpringBootTest(classes=BobbuyApplication.class)
class BobbuyReleaseGateTest {
    @Autowired BobbuyStore store;
    @Autowired ProcurementReceiptRepository receipts;

    @Test void acceptanceFixturesAreConsistentAndExistingDataIsNotReseeded() {
        ReflectionTestUtils.setField(store,"seedPickingFixtureEnabled",true);
        ReflectionTestUtils.setField(store,"seedStorefrontFixtureEnabled",true);
        try {
            store.seed();
            assertThat(store.listProducts()).hasSize(8);
            assertThat(store.getProduct("prd-1000").orElseThrow().getVisibilityStatus()).isEqualTo(ProductVisibility.DRAFTER_ONLY);
            assertThat(store.getProduct("demo-strawberries").orElseThrow().getMediaGallery().get(0).getUrl()).isEqualTo("/assets/products/strawberries.png");
            assertThat(store.getOrderByBusinessId("20260117002").orElseThrow().getStatus()).isEqualTo(OrderStatus.CONFIRMED);
            assertThat(receipts.findAll()).hasSize(1);
            assertThat(receipts.findAll().get(0).getManualReconciliationResult()).containsKey("matchedOrderLines");
            ReflectionTestUtils.setField(store,"forceResetOnSeedInvoke",false);
            store.seed();
            assertThat(receipts.findAll()).hasSize(1);
            assertThat(store.listProducts()).hasSize(8);
        } finally {
            ReflectionTestUtils.setField(store,"seedPickingFixtureEnabled",false);
            ReflectionTestUtils.setField(store,"seedStorefrontFixtureEnabled",false);
            ReflectionTestUtils.setField(store,"forceResetOnSeedInvoke",true);
            store.seed();
        }
    }

    @Test void quickOrderUsesCatalogPriceAndMergesRepeatedBusinessOrder() {
        store.seed();
        var request = new com.bobbuy.api.OrderPlacementRequest();
        request.setSkuId("prd-1000"); request.setBusinessId("RELEASE-QUICK-ORDER"); request.setQuantity(2);
        var first = store.quickOrder(2000L,request);
        assertThat(first.getTotalAmount()).isEqualTo(65.0);
        request.setQuantity(1);
        var merged = store.quickOrder(2000L,request);
        assertThat(merged.getId()).isEqualTo(first.getId());
        assertThat(merged.getLines()).extracting(OrderLine::getSkuId).containsOnly("prd-1000");
        assertThat(merged.getLines().stream().mapToInt(OrderLine::getQuantity).sum()).isEqualTo(3);
        assertThat(merged.getTotalAmount()).isEqualTo(97.5);
        assertThatThrownBy(()->store.quickOrder(-1L,request)).isInstanceOf(com.bobbuy.api.response.ApiException.class);
    }

    @Test void catalogMetadataAndReferenceTiersDoNotOverwriteBasePrice() {
        store.seed();
        var patch = new ProductPatch();
        patch.setWeight(0.75); patch.setVolume(1.5);
        patch.setMediaGallery(java.util.List.of(new MediaGalleryItem("/synthetic.png",MediaType.IMAGE,java.util.Map.of())));
        patch.setIsTemporary(true); patch.setVisibilityStatus(ProductVisibility.DRAFTER_ONLY);
        patch.setItemNumber("000987"); patch.setAttributes(java.util.Map.of("unit","100g"));
        patch.setPriceTiers(java.util.List.of(new PriceTier("Reference",99,"JPY",false)));
        var updated = store.patchProduct("prd-1000",patch).orElseThrow();
        assertThat(updated.getBasePrice()).isEqualTo(32.5);
        assertThat(updated.getWeight()).isEqualTo(0.75); assertThat(updated.getVolume()).isEqualTo(1.5);
        assertThat(updated.getPriceTiers().get(0).currency()).isEqualTo("JPY");
        assertThat(updated.getAttributes()).containsEntry("unit","100g");
        assertThat(updated.getMediaGallery().get(0).getUrl()).isEqualTo("/synthetic.png");
        assertThat(updated.getVisibilityStatus()).isEqualTo(ProductVisibility.DRAFTER_ONLY);
        assertThat(store.findProductByItemNumber(null)).isEmpty();
        assertThat(store.findProductByItemNumber(" ")).isEmpty();
        assertThat(store.findProductByItemNumber("000987").orElseThrow().getId()).isEqualTo(updated.getId());
        assertThat(store.findProductByItemNumber("missing-code")).isEmpty();
    }
}
