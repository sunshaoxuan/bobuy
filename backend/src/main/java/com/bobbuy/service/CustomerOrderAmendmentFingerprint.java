package com.bobbuy.service;

import com.bobbuy.api.CustomerOrderAmendmentRequest;
import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Comparator;
import java.util.HexFormat;

/** Payload identity, not an order revision. Revisions must also cover server-owned commitments. */
public final class CustomerOrderAmendmentFingerprint {
    private CustomerOrderAmendmentFingerprint() {}
    public static String of(long customerId, long orderId, CustomerOrderAmendmentRequest request) {
        if (customerId <= 0 || orderId <= 0 || request == null) throw new IllegalArgumentException("amendment.identity");
        try {
            var bytes = new ByteArrayOutputStream();
            var out = new DataOutputStream(bytes);
            text(out, "customer-amendment-v2"); out.writeLong(customerId); out.writeLong(orderId);
            text(out, request.expectedRevision()); // requestId is the lookup key, not payload content.
            out.writeInt(request.lines().size());
            for (var line : request.lines().stream().sorted(Comparator.comparing(CustomerOrderAmendmentRequest.Line::productId)).toList()) {
                text(out, line.productId()); out.writeInt(line.quantity()); text(out,line.priceToken());
                out.writeBoolean(line.priceRevision()!=null); if(line.priceRevision()!=null)out.writeLong(line.priceRevision()); text(out,line.currency());
            }
            var d = request.delivery(); out.writeBoolean(d != null);
            if (d != null) for (var value : new String[]{d.contactName(), d.phone(), d.countryRegion(), d.city(), d.addressLine(), d.postalCode()}) text(out, value);
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes.toByteArray()));
        } catch (IOException | NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    private static void text(DataOutputStream out, String value) throws IOException {
        if (value == null) { out.writeInt(-1); return; }
        var bytes = value.getBytes(StandardCharsets.UTF_8); out.writeInt(bytes.length); out.write(bytes);
    }
}
