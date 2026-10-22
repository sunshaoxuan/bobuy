package com.bobbuy.security;

import com.bobbuy.api.response.*;
import com.bobbuy.repository.*;
import jakarta.servlet.http.*;
import java.util.Map;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.*;
import org.springframework.web.servlet.config.annotation.*;

/** Enforce ownership before legacy maintenance controllers reach their resource services. */
@Configuration
public class MerchantResourceGuard implements WebMvcConfigurer, HandlerInterceptor {
    private final TripRepository trips;
    private final OrderHeaderRepository orders;
    public MerchantResourceGuard(TripRepository trips, OrderHeaderRepository orders) { this.trips = trips; this.orders = orders; }
    @Override public void addInterceptors(InterceptorRegistry registry) { registry.addInterceptor(this).addPathPatterns("/api/**"); }
    @Override public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (MerchantScope.current() == null) return true;
        @SuppressWarnings("unchecked") Map<String,String> vars = (Map<String,String>) request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE);
        if (vars == null) return true;
        String uri = request.getRequestURI();
        if (vars.containsKey("tripId")) requireTrip(Long.valueOf(vars.get("tripId")));
        if (uri.startsWith("/api/trips/") && vars.containsKey("id")) requireTrip(Long.valueOf(vars.get("id")));
        if (uri.startsWith("/api/orders/") && vars.containsKey("id")) requireOrder(Long.valueOf(vars.get("id")));
        if (vars.containsKey("orderId")) requireOrder(Long.valueOf(vars.get("orderId")));
        // These older aggregates span merchants and must not expose shared balances or global account mutations.
        if (uri.startsWith("/api/procurement/wallets/") ||
            (uri.startsWith("/api/users") && !request.getMethod().equals("GET"))) {
            throw new ApiException(ErrorCode.FORBIDDEN, "请使用当前商家的客户与订单维护入口");
        }
        return true;
    }
    private void requireOrder(Long id) { orders.findById(id).ifPresent(order -> requireTrip(order.getTripId())); }
    private void requireTrip(Long id) { trips.findById(id).ifPresent(t -> MerchantScope.require(t.getAgentId())); }
}
