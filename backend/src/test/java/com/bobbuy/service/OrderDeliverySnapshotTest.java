package com.bobbuy.service;

import com.bobbuy.model.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class OrderDeliverySnapshotTest {
    @Test void immutableSnapshotRequiresAddressButNotPhonePostalOrGeolocation() throws Exception {
        var address=new User.UserAddress();address.setContactName(" Buyer ");address.setCountryRegion("Japan");address.setCity("Tokyo");address.setAddressLine("Old street");
        var snapshot=OrderDeliverySnapshot.capture(address);address.setCity("Later city");
        assertThat(snapshot.city()).isEqualTo("Tokyo");assertThat(snapshot.contactName()).isEqualTo("Buyer");assertThat(snapshot.phone()).isNull();assertThat(snapshot.postalCode()).isNull();
        var json=new ObjectMapper();assertThat(json.readValue(json.writeValueAsString(snapshot),OrderDeliverySnapshot.class)).isEqualTo(snapshot);
        assertThatThrownBy(()->OrderDeliverySnapshot.capture(new User.UserAddress())).hasMessage("checkout.address_required");
    }
    @Test void managementReplacementPreservesCheckoutMetadataAndLegacyRemainsUnknown() {
        var original=new OrderHeader();original.setCheckoutPayloadHash("bound");original.setDeliverySnapshot(new OrderDeliverySnapshot(1,"Buyer",null,"Japan","Tokyo","Old street",null));
        var replacement=new OrderHeader();replacement.retainProductIdentitiesFrom(original);
        assertThat(replacement.getCheckoutPayloadHash()).isEqualTo("bound");assertThat(replacement.getDeliverySnapshot()).isEqualTo(original.getDeliverySnapshot());
        assertThat(new OrderHeader().getDeliverySnapshot()).isNull();
    }
}
