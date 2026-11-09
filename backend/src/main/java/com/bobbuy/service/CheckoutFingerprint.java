package com.bobbuy.service;

import com.bobbuy.api.response.ApiException;
import com.bobbuy.api.response.ErrorCode;
import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Objects;
import java.util.TreeMap;

/** Canonical request identity; current profile/prices/order status are deliberately not inputs. */
final class CheckoutFingerprint {
    private CheckoutFingerprint() {}
    static String of(StorefrontService.Checkout request) {
        record Quote(Long revision, String currency, String token) {}
        var quantities = new TreeMap<String, Integer>();
        var quotes = new TreeMap<String, Quote>();
        for (var item : request.items()) {
            int quantity = quantities.getOrDefault(item.productId(), 0) + item.quantity();
            if (quantity < 1 || quantity > 99) throw invalid();
            quantities.put(item.productId(), quantity);
            var quote = new Quote(item.priceRevision(), item.currency(), item.priceToken());
            var previous = quotes.putIfAbsent(item.productId(), quote);
            if (previous != null && !Objects.equals(previous, quote)) throw invalid();
        }
        try {
            var bytes = new ByteArrayOutputStream();
            var out = new DataOutputStream(bytes);
            out.writeInt(1); out.writeLong(request.tripId());
            text(out, request.currency() == null ? "JPY" : request.currency());
            out.writeInt(quantities.size());
            for (var entry : quantities.entrySet()) {
                var quote = quotes.get(entry.getKey());
                text(out, entry.getKey()); out.writeInt(entry.getValue());
                text(out, quote.revision() == null ? null : quote.revision().toString());
                text(out, quote.currency()); text(out, quote.token());
            }
            out.flush();
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes.toByteArray()));
        } catch (java.io.IOException | java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException("Cannot bind checkout request", e);
        }
    }
    private static void text(DataOutputStream out, String text) throws java.io.IOException {
        if (text == null) { out.writeInt(-1); return; }
        byte[] value = text.getBytes(StandardCharsets.UTF_8); out.writeInt(value.length); out.write(value);
    }
    private static ApiException invalid() { return new ApiException(ErrorCode.INVALID_REQUEST, "checkout.request_conflict"); }
}
