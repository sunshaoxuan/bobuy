package com.bobbuy.service;

import com.bobbuy.api.response.ApiException;
import com.bobbuy.api.response.ErrorCode;
import com.bobbuy.model.Product;
import com.bobbuy.repository.ProductRepository;
import com.bobbuy.security.MerchantScope;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

@Service
public class ProductCartAvailability {
    private final ProductRepository products;
    private final AuditLogService audit;

    public ProductCartAvailability(ProductRepository products, AuditLogService audit) {
        this.products = products;
        this.audit = audit;
    }

    public record PreviewItem(String id, Map<String, String> name, String itemNumber) {}
    public record Preview(int count, List<PreviewItem> items, String revision) {}
    public record Result(List<String> enabledIds) {}

    @Transactional(readOnly = true)
    public Preview preview() {
        Long merchant = requireMerchant();
        List<Product> disabled = products.findAllByMerchantIdAndCartEnabledFalseOrderById(merchant);
        return new Preview(disabled.size(), disabled.stream()
            .map(product -> new PreviewItem(product.getId(), product.getName(), product.getItemNumber()))
            .toList(), revision(merchant, disabled));
    }

    @Transactional
    public Result enable(String expectedRevision) {
        Long merchant = requireMerchant();
        List<Product> disabled = products.findAllByMerchantIdAndCartEnabledFalseOrderById(merchant);
        if (!revision(merchant, disabled).equals(expectedRevision)) {
            throw new ApiException(ErrorCode.INVALID_STATUS, "cart.availability_stale");
        }
        // Managed products have @Version. A concurrent update rolls back the whole batch.
        disabled.forEach(product -> change(product, true, merchant, audit));
        return new Result(disabled.stream().map(Product::getId).toList());
    }

    static Long requireMerchant() {
        Long merchant = MerchantScope.current();
        if (merchant == null) {
            throw new ApiException(ErrorCode.FORBIDDEN, "cart.availability_forbidden");
        }
        return merchant;
    }

    static void change(Product product, boolean enabled, Long merchant, AuditLogService audit) {
        if (product.isDeleted() || !merchant.equals(product.getMerchantId())) {
            throw new ApiException(ErrorCode.FORBIDDEN, "cart.availability_forbidden");
        }
        boolean previous = product.isCartEnabled();
        if (previous != enabled) {
            product.setCartEnabled(enabled);
            audit.logProductCartChange(product.getId(), previous, enabled, merchant);
        }
    }

    private static String revision(Long merchant, List<Product> products) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update(merchant.toString().getBytes(StandardCharsets.UTF_8));
            for (Product product : products) {
                String id = product.getId();
                String versionedId = "|" + id.length() + ":" + id + ":" + product.getRecordVersion();
                digest.update(versionedId.getBytes(StandardCharsets.UTF_8));
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
