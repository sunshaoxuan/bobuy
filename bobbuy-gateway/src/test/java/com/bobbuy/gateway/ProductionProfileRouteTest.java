package com.bobbuy.gateway;

import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.cloud.gateway.config.GatewayProperties;
import org.springframework.cloud.gateway.handler.predicate.PathRoutePredicateFactory;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.io.FileSystemResource;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;

import static org.assertj.core.api.Assertions.assertThat;

class ProductionProfileRouteTest {
  private GatewayProperties productionRoutes() throws Exception {
    Path root = Path.of("").toAbsolutePath();
    while (!root.resolve("infra/nacos/config/gateway-service.yaml").toFile().isFile()) {
      root = root.getParent();
      if (root == null) throw new IllegalStateException("Production route config missing");
    }
    var env = new StandardEnvironment();
    for (var source : new YamlPropertySourceLoader().load("production-gateway",
        new FileSystemResource(root.resolve("infra/nacos/config/gateway-service.yaml")))) {
      env.getPropertySources().addFirst(source);
    }
    return Binder.get(env).bind("spring.cloud.gateway", GatewayProperties.class).get();
  }

  private String destination(GatewayProperties properties, String method, String path) {
    var exchange = MockServerWebExchange.from(MockServerHttpRequest.method(org.springframework.http.HttpMethod.valueOf(method), path));
    var paths = new PathRoutePredicateFactory();
    return properties.getRoutes().stream().filter(route -> route.getPredicates().stream().allMatch(predicate -> {
      assertThat(predicate.getName()).isEqualTo("Path");
      var config = new PathRoutePredicateFactory.Config();
      config.setPatterns(List.copyOf(predicate.getArgs().values()));
      return paths.apply(config).test(exchange);
    })).findFirst().orElseThrow().getUri().toString();
  }

  @Test void profileReadsAndWritesReachCoreBeforeTheBroadAuthRoute() throws Exception {
    var properties = productionRoutes();
    for (String method : List.of("GET", "PATCH")) {
      assertThat(destination(properties, method, "/api/auth/profile")).isEqualTo("lb://core-service");
    }
    // Reverting the exact route must reproduce the original wrong destination.
    properties.getRoutes().removeIf(route -> route.getId().equals("self-profile-route"));
    assertThat(destination(properties, "GET", "/api/auth/profile")).isEqualTo("lb://auth-service");
  }

  @Test void existingServiceBoundariesStayIntact() throws Exception {
    var properties = productionRoutes();
    for (String path : List.of("/api/auth/login", "/api/auth/refresh", "/api/auth/me", "/api/auth/profile-other")) {
      assertThat(destination(properties, "POST", path)).isEqualTo("lb://auth-service");
    }
    assertThat(destination(properties, "GET", "/api/storefront/products")).isEqualTo("lb://core-service");
    assertThat(destination(properties, "POST", "/api/ai/chat")).isEqualTo("lb://ai-service");
    assertThat(destination(properties, "GET", "/api/chat/messages")).isEqualTo("lb://im-service");
  }
}
