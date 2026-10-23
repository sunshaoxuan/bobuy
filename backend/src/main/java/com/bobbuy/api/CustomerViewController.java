package com.bobbuy.api;

import com.bobbuy.api.response.ApiResponse;
import com.bobbuy.model.OrderHeader;
import com.bobbuy.model.Trip;
import com.bobbuy.service.BobbuyStore;
import com.bobbuy.service.ProcurementHudService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** Explicit customer routes keep purchases separate from a dual-role merchant's sales. */
@RestController
@RequestMapping("/api/customer")
public class CustomerViewController {
    private final BobbuyStore store;
    private final ProcurementHudService procurement;
    public CustomerViewController(BobbuyStore store, ProcurementHudService procurement) { this.store = store; this.procurement = procurement; }
    @GetMapping("/trips") public ApiResponse<List<Trip>> trips() { return ApiResponse.success(store.listTrips()); }
    @GetMapping("/orders") public ApiResponse<List<OrderHeader>> orders(@RequestParam(required = false) Long tripId, Authentication authentication) {
        return ApiResponse.success(store.listOrders(tripId, authentication));
    }
    @GetMapping("/procurement/{tripId}/ledger")
    public ApiResponse<List<CustomerBalanceLedgerResponse>> ledger(@PathVariable Long tripId, Authentication authentication) {
        return ApiResponse.success(procurement.getCustomerBalanceLedger(tripId, authentication));
    }
    @PostMapping("/procurement/{tripId}/ledger/{businessId}/confirm")
    public ApiResponse<CustomerBalanceLedgerResponse> confirm(@PathVariable Long tripId, @PathVariable String businessId,
            @Valid @RequestBody LedgerConfirmationRequest request, Authentication authentication) {
        return ApiResponse.success(procurement.confirmCustomerLedger(tripId, businessId, request, authentication));
    }
}
