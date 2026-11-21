package com.bobbuy.service;

import com.bobbuy.api.BobbuyApplication;
import com.bobbuy.api.response.ApiException;
import com.bobbuy.model.AuditLog;
import com.bobbuy.model.Product;
import com.bobbuy.model.ProductPatch;
import com.bobbuy.model.ProductVisibility;
import com.bobbuy.repository.ProductRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(classes = BobbuyApplication.class, properties = {
    "spring.datasource.url=jdbc:h2:mem:cart_availability_fixture;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE"
})
class ProductCartAvailabilityTest {
    @Autowired ProductCartAvailability availability;
    @Autowired BobbuyStore store;
    @Autowired ProductRepository products;
    @Autowired AuditLogService audit;
    @Autowired PlatformTransactionManager transactions;

    @AfterEach
    void clearIdentity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void singlePatchAndBulkOnlyChangeOwnedRowsAndAuditOncePerActualChange() {
        long merchant = 8451L;
        Product owned = product(merchant, true);
        Product other = product(merchant + 1, false);
        Product draft = product(merchant, false);
        draft.setVisibilityStatus(ProductVisibility.DRAFTER_ONLY);
        products.saveAndFlush(draft);
        signIn(merchant);

        ProductPatch patch = new ProductPatch();
        patch.setCartEnabled(false);
        assertThat(store.patchProduct(other.getId(), patch)).isEmpty();
        assertThat(store.patchProduct(owned.getId(), patch).orElseThrow().isCartEnabled()).isFalse();
        store.patchProduct(owned.getId(), patch).orElseThrow();
        assertThat(logs(owned)).singleElement().satisfies(entry -> {
            assertThat(entry.getBeforeValue()).isEqualTo("true");
            assertThat(entry.getAfterValue()).isEqualTo("false");
            assertThat(entry.getUserId()).isEqualTo(merchant);
            assertThat(entry.getCreatedAt()).isNotNull();
        });

        var preview = availability.preview();
        assertThat(preview.count()).isEqualTo(2);
        assertThat(preview.items()).extracting(ProductCartAvailability.PreviewItem::id)
            .containsExactlyInAnyOrder(owned.getId(), draft.getId());
        assertThat(products.findById(owned.getId()).orElseThrow().isCartEnabled()).isFalse();
        assertThat(logs(draft)).isEmpty();
        signIn(merchant + 1);
        assertThatThrownBy(() -> availability.enable(preview.revision())).isInstanceOf(ApiException.class);
        signIn(merchant);

        assertThat(availability.enable(preview.revision()).enabledIds())
            .containsExactlyInAnyOrder(owned.getId(), draft.getId());
        assertThat(availability.preview().count()).isZero();
        assertThat(products.findById(owned.getId()).orElseThrow().publiclyCartEnabled()).isTrue();
        assertThat(products.findById(draft.getId()).orElseThrow().publiclyCartEnabled()).isFalse();
        assertThat(products.findById(other.getId()).orElseThrow().isCartEnabled()).isFalse();
        assertThat(logs(owned)).extracting(AuditLog::getAfterValue).containsExactly("false", "true");
        assertThat(logs(draft)).singleElement().satisfies(entry -> {
            assertThat(entry.getAction()).isEqualTo("CART_ENABLED_CHANGE");
            assertThat(entry.getBeforeValue()).isEqualTo("false");
            assertThat(entry.getAfterValue()).isEqualTo("true");
        });
    }

    @Test
    void stalePreviewAndRollbackNeverProduceAuditOrPersistChanges() {
        long merchant = 8461L;
        Product first = product(merchant, false);
        signIn(merchant);
        var oldPreview = availability.preview();
        Product later = product(merchant, false);
        assertThatThrownBy(() -> availability.enable(oldPreview.revision())).isInstanceOf(ApiException.class);
        var current = availability.preview();
        new TransactionTemplate(transactions).executeWithoutResult(status -> {
            assertThat(availability.enable(current.revision()).enabledIds()).hasSize(2);
            status.setRollbackOnly();
        });
        assertThat(logs(first)).isEmpty();
        assertThat(logs(later)).isEmpty();
        assertThat(availability.preview().count()).isEqualTo(2);
        clearIdentity();
        assertThatThrownBy(availability::preview).isInstanceOf(ApiException.class);
    }

    @Test
    void softDeletedProductsRemainOutsidePreviewAndPublicAvailability() {
        long merchant = 8471L;
        Product deleted = product(merchant, false);
        deleted.setDeletedAt(Instant.now());
        products.saveAndFlush(deleted);
        signIn(merchant);
        assertThat(availability.preview().count()).isZero();
        deleted.setCartEnabled(true);
        assertThat(deleted.publiclyCartEnabled()).isFalse();
    }

    private Product product(long merchant, boolean enabled) {
        Product product = new Product();
        product.setId(UUID.randomUUID().toString());
        product.setMerchantId(merchant);
        product.setName(Map.of("en-US", "Cart fixture"));
        product.setCartEnabled(enabled);
        return products.saveAndFlush(product);
    }

    private List<AuditLog> logs(Product product) {
        return audit.listLogs().stream().filter(entry -> product.getId().equals(entry.getProductId())).toList();
    }

    private void signIn(long merchant) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
            "agent-" + merchant, "", AuthorityUtils.createAuthorityList("ROLE_AGENT")));
    }
}
