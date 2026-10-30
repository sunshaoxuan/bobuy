package com.bobbuy.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.slf4j.LoggerFactory;
import java.nio.file.*;
import java.util.Map;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

/** Explicit opt-in, synthetic text only. Never part of an ordinary CI model call. */
@EnabledIfEnvironmentVariable(named="BOBBUY_EXISTING_AI_PROBE",matches="true")
class ExistingAiConnectionManualTest {
 String value(String key,String fallback){String v=System.getenv(key);return v==null||v.isBlank()?fallback:v;}
 @Test void existingConnectionAnswersSyntheticText() throws Exception {
  ((ch.qos.logback.classic.LoggerContext)LoggerFactory.getILoggerFactory()).reset();
  var events=new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();events.start();
  ((ch.qos.logback.classic.Logger)LoggerFactory.getLogger(LlmGateway.class)).addAppender(events);
  var g=new LlmGateway(new ObjectMapper(),value("BOBBUY_AI_LLM_MAIN_URL",""),value("BOBBUY_AI_LLM_MAIN_MODEL","qwen2.5:7b"),value("BOBBUY_AI_LLM_MAIN_PROVIDER","auto"),"",30,
   value("BOBBUY_AI_LLM_CODEX_BRIDGE_URL",""),value("BOBBUY_AI_LLM_CODEX_BRIDGE_MODEL","gpt-5.3-codex"),value("BOBBUY_AI_LLM_CODEX_BRIDGE_API_KEY",""),45,
   value("BOBBUY_AI_LLM_CODEX_BRIDGE_SECRET_SALT",""),value("BOBBUY_AI_LLM_CODEX_BRIDGE_SECRET_NONCE",""),value("BOBBUY_AI_LLM_CODEX_BRIDGE_SECRET_CIPHERTEXT",""),value("BOBBUY_AI_LLM_CODEX_BRIDGE_SECRET_TAG",""),
   Integer.parseInt(value("BOBBUY_AI_LLM_CODEX_BRIDGE_SECRET_ITERATIONS","200000")),value("BOBBUY_AI_SECRET_MASTER_PASSWORD",""),3,value("BOBBUY_AI_LLM_EDGE_URL",""),value("BOBBUY_AI_LLM_EDGE_MODEL","llama3.2-vision:11b"),"");
  g.initializeMainProvider();
  if ("metadata".equals(System.getenv("BOBBUY_AI_PROBE_MODE"))) {
   var destination=java.net.URI.create(value("BOBBUY_AI_LLM_CODEX_BRIDGE_URL",""));
   assertEquals("https",destination.getScheme(),"Metadata credential transmission requires a verified HTTPS API address");
   assertNull(destination.getUserInfo());assertNotNull(destination.getHost());
   var keyMethod=LlmGateway.class.getDeclaredMethod("resolveCodexBridgeApiKey");keyMethod.setAccessible(true);
   @SuppressWarnings("unchecked") var key=(java.util.Optional<String>)keyMethod.invoke(g);
   var raw=org.springframework.web.client.RestClient.create().get().uri(value("BOBBUY_AI_LLM_CODEX_BRIDGE_URL","")+"/models")
    .header("Authorization","Bearer "+key.orElseThrow()).retrieve().body(String.class);
   var tree=new ObjectMapper().readTree(raw);var ids=new java.util.ArrayList<String>();
   for(var item:tree.path("data"))if(item.path("id").isTextual())ids.add(item.path("id").asText());
   new ObjectMapper().writeValue(Path.of(System.getenv("BOBBUY_AI_PROBE_RECEIPT")).toFile(),Map.of("probe","existing-model-metadata-only","http",200,"configuredModelListed",ids.contains(g.getMainModel()),"modelIds",ids,"modelCalled",false));
   return;
  }
  var output=g.generate("Synthetic Bobuy connectivity test. Reply with only BOBUY_AI_OK. No product or personal data.",null,null);
  boolean pass=output.map(s->s.trim().equals("BOBUY_AI_OK")).orElse(false);
  String diagnostic="NO_ERROR_RECORDED";
  for(var event:events.list){String message=event.getFormattedMessage().toLowerCase();
   if(message.contains("gateway error")){diagnostic="PROVIDER_ERROR";for(String status:List.of("400","401","403","404","408","429","500","502","503","504"))if(message.contains(status)){diagnostic="HTTP_"+status;break;}
    if(message.contains("timed out")||message.contains("timeout"))diagnostic="TIMEOUT";
    if(message.contains("connection refused"))diagnostic="CONNECTION_REFUSED";}}
  new ObjectMapper().writeValue(Path.of(System.getenv("BOBBUY_AI_PROBE_RECEIPT")).toFile(),Map.of("provider",g.getActiveMainProvider(),"model",g.getMainModel(),"syntheticOnly",true,"exactReply",pass,"hasResponse",output.isPresent(),"failureClass",diagnostic,"credentialsCreated",false,"productionChanged",false));
  assertTrue(pass,"Existing connection did not return the synthetic marker; no fallback success claimed");
 }
}
