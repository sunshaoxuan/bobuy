package com.bobbuy.api;

import com.bobbuy.service.CustomerOrderAmendmentPolicy;
import java.util.List;
import java.util.Map;
import java.math.BigDecimal;

/** Separate from management DTOs. Editability and revision are authoritative server output. */
public record CustomerOrderAmendmentView(long orderId, String revision,
        CustomerOrderAmendmentPolicy.Reason reason, boolean editable,
        List<CustomerOrderAmendmentRequest.Line> lines, CustomerOrderAmendmentRequest.Delivery delivery,
        Long merchantId, Long tripId, String currency, BigDecimal totalAmount, List<ProductOption> products,
        List<LineSnapshot> originalProducts) {
    public CustomerOrderAmendmentView { lines = List.copyOf(lines); products = List.copyOf(products);originalProducts=List.copyOf(originalProducts); }
    public record LineSnapshot(String id,Map<String,String> name,String brand,String itemNumber,String model,String packaging,Map<String,String> specifications,String unit) {
        public LineSnapshot { name=Map.copyOf(name);specifications=Map.copyOf(specifications); }
    }
    public record ProductOption(String id, Map<String,String> name, BigDecimal amount, String currency,
            String unit, long priceRevision, String priceToken, String brand, String itemNumber,
            String model, String packaging, Map<String,String> specifications) {
        public ProductOption { name = Map.copyOf(name);specifications=Map.copyOf(specifications); }
    }
}
