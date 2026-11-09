package com.bobbuy.model;

import com.bobbuy.api.response.ApiException;
import com.bobbuy.api.response.ErrorCode;

/** Order-time delivery facts. Never follows later edits of the customer's profile. */
public record OrderDeliverySnapshot(int version, String contactName, String phone,
        String countryRegion, String city, String addressLine, String postalCode) {
    public static OrderDeliverySnapshot capture(User.UserAddress address) {
        if (address == null || blank(address.getContactName()) || blank(address.getCountryRegion())
                || blank(address.getCity()) || blank(address.getAddressLine())) {
            throw new ApiException(ErrorCode.INVALID_REQUEST, "checkout.address_required");
        }
        return new OrderDeliverySnapshot(1, clean(address.getContactName()), clean(address.getPhone()),
                clean(address.getCountryRegion()), clean(address.getCity()), clean(address.getAddressLine()), clean(address.getPostalCode()));
    }
    private static boolean blank(String value) { return value == null || value.isBlank(); }
    private static String clean(String value) { return blank(value) ? null : value.strip(); }
}
