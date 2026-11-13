package com.bobbuy.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class LlmGatewayTest {

  private HttpServer mainServer;
  private HttpServer bridgeServer;

  @AfterEach
  void tearDown() {
    if (mainServer != null) {
      mainServer.stop(0);
    }
    if (bridgeServer != null) {
      bridgeServer.stop(0);
    }
  }

  @Test
  void generateFallsBackToCodexBridgeWhenOllamaReturnsEmptyResponse() throws Exception {
    mainServer = HttpServer.create(new InetSocketAddress(0), 0);
    mainServer.createContext("/api/tags", exchange -> writeJson(exchange, 200, "{\"models\":[]}"));
    mainServer.createContext("/api/generate", exchange -> writeJson(exchange, 200, "{\"response\":\"\"}"));
    mainServer.start();

    AtomicReference<String> bridgeRequestBody = new AtomicReference<>();
    bridgeServer = HttpServer.create(new InetSocketAddress(0), 0);
    bridgeServer.createContext("/v1/models", exchange -> writeJson(exchange, 200, "{\"data\":[]}"));
    bridgeServer.createContext("/v1/chat/completions", exchange -> {
      bridgeRequestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
      writeJson(exchange, 200, """
        {
          "choices": [
            {
              "message": {
                "content": [
                  { "type": "text", "text": "{\\"name\\":\\"Mixed Seafood\\",\\"basePrice\\":2698}" }
                ]
              }
            }
          ]
        }
        """);
    });
    bridgeServer.start();

    LlmGateway gateway = new LlmGateway(
        new ObjectMapper(),
        "http://127.0.0.1:" + mainServer.getAddress().getPort(),
        "qwen2.5:7b",
        "auto",
        "",
        1,
        "http://127.0.0.1:" + bridgeServer.getAddress().getPort() + "/v1",
        "gpt-6.1-terra",
        "test-key",
        5,
        "",
        "",
        "",
        "",
        200000,
        "",
        1,
        "",
        "llava",
        ""
    );
    gateway.initializeMainProvider();

    Optional<String> response = gateway.generate("Return JSON", null, null);

    assertThat(response).contains("{\"name\":\"Mixed Seafood\",\"basePrice\":2698}");
    assertThat(gateway.getActiveMainProvider()).isEqualTo("codex-bridge");
    assertThat(bridgeRequestBody.get()).contains("\"messages\"");
    assertThat(new ObjectMapper().readTree(bridgeRequestBody.get()).path("messages").get(0).path("content").asText())
        .isEqualTo("Return JSON");
  }

  @Test
  void bridgeVisionCarriesImageWhenNoEdgeConfigured() throws Exception {
    AtomicReference<String> body=new AtomicReference<>();
    bridgeServer=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
    bridgeServer.createContext("/v1/models",exchange->writeJson(exchange,200,"{\"data\":[]}"));
    bridgeServer.createContext("/v1/chat/completions",exchange->{body.set(new String(exchange.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));writeJson(exchange,200,"{\"choices\":[{\"message\":{\"content\":\"synthetic visual result\"}}]}");});bridgeServer.start();
    var gateway=new LlmGateway(new ObjectMapper(),"","fixture","codex-bridge","",1,"http://127.0.0.1:"+bridgeServer.getAddress().getPort()+"/v1","fixture","synthetic-test-key",5,"","","","",200000,"",1,"",""," ");
    gateway.initializeMainProvider();assertThat(gateway.generate("Read synthetic image",null,java.util.List.of("data:image/png;base64,eA=="))).contains("synthetic visual result");
    var content=new ObjectMapper().readTree(body.get()).path("messages").get(0).path("content");assertThat(content.get(0).path("text").asText()).isEqualTo("Read synthetic image");assertThat(content.get(1).path("image_url").path("url").asText()).isEqualTo("data:image/png;base64,eA==");
  }

  @Test
  void remotePlainHttpNeverReceivesCredentials(){
    var gateway=new LlmGateway(new ObjectMapper(),"","fixture","codex-bridge","",1,"http://example.invalid/v1","fixture","synthetic-not-a-real-secret",1,"","","","",200000,"",1,"","","");
    gateway.initializeMainProvider();assertThat(gateway.getActiveMainProvider()).isEqualTo("unconfigured");assertThat(gateway.generate("Synthetic",null,null)).isEmpty();
  }

  @Test
  void unavailableCodexCommandIsNotSelectedAsMainProvider() {
    LlmGateway gateway = new LlmGateway(
        new ObjectMapper(),
        "",
        "qwen2.5:7b",
        "codex",
        "definitely-not-installed-bobbuy-codex",
        1,
        "",
        "gpt-6.1-terra",
        "",
        5,
        "",
        "",
        "",
        "",
        200000,
        "",
        1,
        "",
        "llava",
        ""
    );

    gateway.initializeMainProvider();

    assertThat(gateway.getActiveMainProvider()).isEqualTo("unconfigured");
    assertThat(gateway.generate("Return JSON", null, null)).isEmpty();
  }

  private void writeJson(HttpExchange exchange, int status, String body) throws IOException {
    byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().set("Content-Type", "application/json");
    exchange.sendResponseHeaders(status, bytes.length);
    try (OutputStream output = exchange.getResponseBody()) {
      output.write(bytes);
    }
  }
}
