package com.bobbuy.security;

import com.bobbuy.api.response.*;
import org.springframework.security.core.context.SecurityContextHolder;

public final class MerchantScope {
    private MerchantScope() {}
    public static boolean customerView() {
        var attributes = org.springframework.web.context.request.RequestContextHolder.getRequestAttributes();
        return attributes instanceof org.springframework.web.context.request.ServletRequestAttributes request &&
            request.getRequest().getRequestURI().startsWith("/api/customer/");
    }
    public static Long current() {
        if (customerView()) return null;
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getAuthorities().stream().noneMatch(a -> a.getAuthority().equals("ROLE_AGENT"))) return null;
        if (auth.getPrincipal() instanceof BobbuyAuthenticatedUser user) return user.id();
        String name = auth.getName();
        try { return Long.valueOf(name.substring(name.lastIndexOf('-') + 1)); }
        catch (NumberFormatException ex) { throw new ApiException(ErrorCode.FORBIDDEN, "商家身份无效"); }
    }
    public static boolean visible(Long owner) { return current() == null || current().equals(owner); }
    public static void require(Long owner) {
        if (!visible(owner)) throw new ApiException(ErrorCode.FORBIDDEN, "无法访问其他商家的数据");
    }
}
