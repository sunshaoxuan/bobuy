package com.bobbuy.security;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;

class TrustedClientIpResolverTest {
    @Test void ignoresSpoofedForwardingHeaderFromUntrustedPeer(){
        var request=new MockHttpServletRequest();request.setRemoteAddr("198.51.100.8");request.addHeader("X-Forwarded-For","203.0.113.4");
        assertThat(new TrustedClientIpResolver("10.0.0.0/8").resolve(request)).isEqualTo("198.51.100.8");
    }
    @Test void walksTrustedProxyChainFromTheRight(){
        var request=new MockHttpServletRequest();request.setRemoteAddr("10.0.0.2");request.addHeader("X-Forwarded-For","203.0.113.4, 10.0.0.1");
        assertThat(new TrustedClientIpResolver("10.0.0.0/8").resolve(request)).isEqualTo("203.0.113.4");
    }
}
