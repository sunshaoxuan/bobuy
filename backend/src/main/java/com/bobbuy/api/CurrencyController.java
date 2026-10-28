package com.bobbuy.api;

import com.bobbuy.api.response.ApiResponse;
import com.bobbuy.service.ProductSaleService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Shared currency reference data; retain existing public and merchant read contracts. */
@RestController
public class CurrencyController {
    private final ProductSaleService currencies;
    public CurrencyController(ProductSaleService currencies) { this.currencies = currencies; }
    @GetMapping({"/api/storefront/currencies", "/api/merchant/currencies"})
    public ApiResponse<?> list() { return ApiResponse.success(currencies.currencies()); }
}
