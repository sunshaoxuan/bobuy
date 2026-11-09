package com.bobbuy.api;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;

/** Customer input only. Identity, prices, payment and fulfillment come from the server. */
public record CustomerOrderAmendmentRequest(String requestId, String expectedRevision,
        List<Line> lines, Delivery delivery) {
    public CustomerOrderAmendmentRequest {
        if (requestId == null || !UUID.fromString(requestId).toString().equals(requestId))
            throw new IllegalArgumentException("amendment.request_id");
        if (expectedRevision == null || !expectedRevision.matches("[0-9a-f]{64}"))
            throw new IllegalArgumentException("amendment.revision");
        if (lines == null || lines.isEmpty() || lines.size() > 50)
            throw new IllegalArgumentException("amendment.lines");
        lines = List.copyOf(lines);
        var ids = new HashSet<String>();
        for (var line : lines) if (!ids.add(line.productId()))
            throw new IllegalArgumentException("amendment.duplicate_product");
    }
    @JsonAnySetter public void rejectUnknown(String key, Object value) {
        throw new IllegalArgumentException("amendment.unknown_field:" + key);
    }
    public record Line(@com.fasterxml.jackson.databind.annotation.JsonDeserialize(using=ProductIdReader.class) String productId,
            @com.fasterxml.jackson.databind.annotation.JsonDeserialize(using=QuantityReader.class) int quantity,
            String priceToken, Long priceRevision, String currency) {
        public Line(String productId, int quantity) { this(productId,quantity,null,null,null); }
        public Line {
            // Match Product.id / checkout Item: a String key, not the Long order-line ID.
            if (productId == null || productId.isBlank() || productId.length() > 255)
                throw new IllegalArgumentException("amendment.product_id");
            if (quantity < 1 || quantity > 99)
                throw new IllegalArgumentException("amendment.quantity");
            if ((priceToken != null && priceToken.length() > 64) || (priceRevision != null && priceRevision < 0)
                    || (currency != null && !currency.matches("[A-Z]{3}"))) throw new IllegalArgumentException("amendment.quote");
        }
        @JsonAnySetter public void rejectUnknown(String key, Object value) {
            throw new IllegalArgumentException("amendment.unknown_line_field:" + key);
        }
    }
    public static class ProductIdReader extends com.fasterxml.jackson.databind.JsonDeserializer<String> {
        @Override public String deserialize(com.fasterxml.jackson.core.JsonParser p,com.fasterxml.jackson.databind.DeserializationContext context)throws java.io.IOException {
            if(p.currentToken()!=com.fasterxml.jackson.core.JsonToken.VALUE_STRING)throw com.fasterxml.jackson.databind.JsonMappingException.from(p,"amendment.product_id");
            return p.getText();
        }
    }
    public static class QuantityReader extends com.fasterxml.jackson.databind.JsonDeserializer<Integer> {
        @Override public Integer deserialize(com.fasterxml.jackson.core.JsonParser p,com.fasterxml.jackson.databind.DeserializationContext context)throws java.io.IOException {
            if(p.currentToken()!=com.fasterxml.jackson.core.JsonToken.VALUE_NUMBER_INT)throw com.fasterxml.jackson.databind.JsonMappingException.from(p,"amendment.quantity");
            return p.getIntValue();
        }
    }
    /** Null delivery means retain the order snapshot. An explicit delivery must be complete. */
    public record Delivery(String contactName, String phone, String countryRegion,
            String city, String addressLine, String postalCode) {
        public Delivery {
            contactName = text(contactName, 120, true);
            phone = text(phone, 40, false);
            countryRegion = text(countryRegion, 120, true);
            city = text(city, 120, true);
            addressLine = text(addressLine, 500, true);
            postalCode = text(postalCode, 30, false);
        }
        @JsonAnySetter public void rejectUnknown(String key, Object value) {
            throw new IllegalArgumentException("amendment.unknown_delivery_field:" + key);
        }
        private static String text(String value, int max, boolean required) {
            value = value == null ? "" : value.strip();
            if ((required && value.isEmpty()) || value.length() > max)
                throw new IllegalArgumentException("amendment.delivery");
            return value.isEmpty() ? null : value;
        }
    }
}
