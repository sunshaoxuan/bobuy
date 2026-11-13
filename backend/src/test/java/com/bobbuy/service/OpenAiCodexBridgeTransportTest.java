package com.bobbuy.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import javax.crypto.Cipher;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OpenAiCodexBridgeTransportTest {
    private HttpServer server;
    private final ObjectMapper mapper = new ObjectMapper();
    private final AtomicReference<JsonNode> request = new AtomicReference<>();
    private final AtomicReference<String> authorization = new AtomicReference<>();

    @BeforeEach void startServer() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/chat/completions", exchange -> {
            request.set(mapper.readTree(exchange.getRequestBody()));
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            byte[] response = "{\"model\":\"fixture\",\"choices\":[{\"message\":{\"content\":\"ok\"}}]}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            try (var output = exchange.getResponseBody()) { output.write(response); }
        });
        server.start();
    }

    @AfterEach void stopServer() { server.stop(0); }

    private ApplicationContextRunner context(boolean enabled, String routingKey) {
        return new ApplicationContextRunner()
                .withPropertyValues("bobbuy.ai.llm.codex.command=", "bobbuy.ai.llm.main.provider=codex-bridge")
                .withBean(ObjectMapper.class, () -> mapper)
                .withBean(BridgeRoutingProperties.class, () -> {
                    var properties = new BridgeRoutingProperties();
                    properties.setEnabled(enabled);
                    properties.setApiKey(routingKey);
                    properties.setUrl("http://127.0.0.1:" + server.getAddress().getPort() + "/v1");
                    var model = new BridgeRoutingProperties.Model();
                    model.setId("fixture");
                    properties.setRoutes(java.util.Map.of(BridgeRoutingProperties.Task.VISION_EXTRACTION, List.of(model)));
                    return properties;
                })
                .withUserConfiguration(CodexBridgeRouter.class, OpenAiCodexBridgeTransport.class, LlmGateway.class);
    }

    @Test void springCreatesRouterWithRoutingDisabledAndEnabled() {
        for (boolean enabled : List.of(false, true)) {
            context(enabled, "synthetic-routing-key").run(ctx -> {
                assertThat(ctx).hasNotFailed().hasSingleBean(CodexBridgeRouter.class);
                assertThat(ctx.getBean(CodexBridgeRouter.class).enabled()).isEqualTo(enabled);
            });
        }
    }

    @Test void normalizesRawImagesAndPreservesUrlsInHttpPayload() {
        var images = List.of("iVBORw0KGgo=", "/9j/4AAQ", "UklGRgAAAABXRUJQ", "eA==",
                "data:image/jpeg;base64,/9j/4AAQ", "https://example.test/image.png", "http://example.test/image.png");
        context(true, "synthetic-routing-key").withPropertyValues("bobbuy.ai.llm.codex-bridge.api-key=synthetic-legacy-key").run(ctx -> {
            var reply = ctx.getBean(OpenAiCodexBridgeTransport.class).complete("fixture", "receipt", images, Duration.ofSeconds(5));
            assertThat(reply.content()).isEqualTo("ok");
            assertThat(authorization.get()).isEqualTo("Bearer synthetic-routing-key");
            var parts = request.get().path("messages").get(0).path("content");
            assertThat(parts.get(0).path("text").asText()).isEqualTo("receipt");
            var expected = List.of("data:image/png;base64," + images.get(0), "data:image/jpeg;base64," + images.get(1),
                    "data:image/webp;base64," + images.get(2), "data:image/png;base64," + images.get(3),
                    images.get(4), images.get(5), images.get(6));
            for (int i = 0; i < expected.size(); i++) {
                assertThat(parts.get(i + 1).path("image_url").path("url").asText()).isEqualTo(expected.get(i));
            }
        });
    }

    @Test void routedRequestUsesExistingEncryptedSecretResolver() throws Exception {
        byte[] salt = "synthetic-salt!!".getBytes(StandardCharsets.UTF_8);
        byte[] nonce = "test-nonce12".getBytes(StandardCharsets.UTF_8);
        var key = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
                .generateSecret(new PBEKeySpec("synthetic-password".toCharArray(), salt, 10000, 256));
        var cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key.getEncoded(), "AES"), new GCMParameterSpec(128, nonce));
        byte[] encrypted = cipher.doFinal("synthetic-encrypted-key".getBytes(StandardCharsets.UTF_8));
        var encoder = Base64.getEncoder();
        context(true, "").withPropertyValues(
                "bobbuy.ai.secret.master-password=synthetic-password",
                "bobbuy.ai.llm.codex-bridge.secret.salt=" + encoder.encodeToString(salt),
                "bobbuy.ai.llm.codex-bridge.secret.nonce=" + encoder.encodeToString(nonce),
                "bobbuy.ai.llm.codex-bridge.secret.ciphertext=" + encoder.encodeToString(Arrays.copyOf(encrypted, encrypted.length - 16)),
                "bobbuy.ai.llm.codex-bridge.secret.tag=" + encoder.encodeToString(Arrays.copyOfRange(encrypted, encrypted.length - 16, encrypted.length)),
                "bobbuy.ai.llm.codex-bridge.secret.iterations=10000"
        ).run(ctx -> {
            assertThat(ctx).hasNotFailed();
            assertThat(ctx.getBean(CodexBridgeRouter.class).route(BridgeRoutingProperties.Task.VISION_EXTRACTION,
                    "receipt", List.of("eA=="), "ok"::equals)).isPresent();
            assertThat(authorization.get()).isEqualTo("Bearer synthetic-encrypted-key");
        });
    }

    @Test void missingCredentialsFailWithoutSendingRequest() {
        context(true, "").run(ctx -> {
            assertThatThrownBy(() -> ctx.getBean(OpenAiCodexBridgeTransport.class)
                    .complete("fixture", "receipt", List.of(), Duration.ofSeconds(5)))
                    .isInstanceOf(CodexBridgeTransport.Failure.class);
            assertThat(request.get()).isNull();
        });
    }
}
