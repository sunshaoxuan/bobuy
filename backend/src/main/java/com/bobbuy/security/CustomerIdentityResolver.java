package com.bobbuy.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.regex.Pattern;

/**
 * 统一客户身份解析组件。
 * <p>
 * 身份解析规则（按优先级）：
 * 1. 纯数字字符串（如 "1001"）→ 直接作为 customerId。
 * 2. 带前缀格式（如 "CUST-1001"、"BIZ-1001"）→ 提取尾部数字作为 customerId，
 *    同时保留原始字符串作为 businessId 候选。
 * 3. 其他格式（如 "role-injected-customer"）→ 无法识别，返回 empty。
 * </p>
 */
@Component
public class CustomerIdentityResolver {

    /** 严格格式：前缀字母+连字符+数字，或纯数字。 */
    private static final Pattern STRICT_PREFIXED = Pattern.compile("^[A-Za-z]+-+(\\d+)$");
    private static final Pattern PURE_NUMERIC = Pattern.compile("^(\\d+)$");

    /**
     * 从 Spring Security principal 名称解析 customerId。
     * 只接受纯数字或前缀格式（如 CUST-1001），拒绝其他格式。
     */
    public Optional<Long> resolveCustomerId(String principalName) {
        if (principalName == null || principalName.isBlank()) {
            return Optional.empty();
        }
        String trimmed = principalName.trim();
        var pureMatch = PURE_NUMERIC.matcher(trimmed);
        if (pureMatch.matches()) {
            return Optional.of(Long.parseLong(pureMatch.group(1)));
        }
        var prefixMatch = STRICT_PREFIXED.matcher(trimmed);
        if (prefixMatch.matches()) {
            return Optional.of(Long.parseLong(prefixMatch.group(1)));
        }
        return Optional.empty();
    }

    /**
     * 从 Authentication 提取 customerId（CUSTOMER 角色专用）。
     */
    public Optional<Long> resolveCustomerId(Authentication authentication) {
        if (authentication == null) {
            return Optional.empty();
        }
        return resolveCustomerId(authentication.getName());
    }

    /**
     * 判断当前认证主体是否具有 CUSTOMER 角色。
     */
    public boolean isCustomer(Authentication authentication) {
        if (authentication == null) {
            return false;
        }
        if (!MerchantScope.customerView() && authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_AGENT"))) return false;
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch("ROLE_CUSTOMER"::equals);
    }
}
