package com.bobbuy.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;

class LlmGatewayPinnedTest {
    private static final URI NODE=URI.create("https://ccnode.briconbric.com:49530/v1");
    static class Fake extends LlmGateway {
        final List<URI> targets=new ArrayList<>();String payload;String models="{\"data\":[{\"id\":\"fixture-model\",\"capabilities\":{\"vision\":true}}]}";
        String raw="{\"model\":\"fixture-model\",\"choices\":[{\"finish_reason\":\"stop\",\"message\":{\"content\":\"{}\"}}]}";
        String transportFailure;
        Fake(){this(NODE.toString(),"synthetic-test-key");}
        Fake(String url,String key){super(new ObjectMapper(),"http://must-not-use-main.invalid","must-not-use-main","openai-compatible","must-not-run-cli",1,url,"fixture-model",key,1,"","","","",200000,"",1,"http://must-not-use-edge.invalid","must-not-use-edge","");}
        @Override public Optional<String> generate(String prompt,String model,List<String> images){throw new AssertionError("legacy fallback called");}
        @Override protected String exchangePinnedJson(URI target,String key,String body){
            targets.add(target);assertEquals("synthetic-test-key",key);if(transportFailure!=null)throw new PinnedFailure(transportFailure);
            if(body==null)return models;payload=body;return raw;
        }
    }
    @Test void configurationIsMetadataOnlyAndWrongNodeFailsBeforeNetwork(){
        var gateway=new Fake();assertTrue(gateway.pinnedConfiguration(NODE).ready());assertTrue(gateway.targets.isEmpty());
        assertEquals("ai.pinned_endpoint",assertThrows(LlmGateway.PinnedFailure.class,()->gateway.generatePinned(URI.create("https://other.invalid/v1"),"{}",List.of())).getMessage());assertTrue(gateway.targets.isEmpty());
        assertFalse(new Fake("https://other.invalid/v1","synthetic-test-key").pinnedConfiguration(NODE).ready());
        assertFalse(new Fake(NODE.toString(),"").pinnedConfiguration(NODE).ready());
    }
    @Test void exactModelDiscoveryAndOneV1PathAndUnknownUsageRemainUnknown(){
        var gateway=new Fake();var result=gateway.generatePinned(NODE,"Return JSON",List.of());
        assertEquals(List.of(URI.create(NODE+"/models"),URI.create(NODE+"/chat/completions")),gateway.targets);
        assertEquals(NODE,result.endpoint());assertEquals("fixture-model",result.model());assertNull(result.promptTokens());assertNull(result.completionTokens());
        assertFalse(gateway.payload.contains("synthetic-test-key"));gateway.generatePinned(NODE,"Again",List.of());
        assertEquals(3,gateway.targets.size()); // one short-lived discovery cache, two actual completions
    }
    @Test void actualImageStaysOnPinnedChatRouteAndRequiresDiscoveredVision(){
        var gateway=new Fake();gateway.generatePinned(NODE,"Inspect pixels",List.of(new LlmGateway.PinnedImage("image/png",new byte[]{1,2,3})));
        assertTrue(gateway.payload.contains("data:image/png;base64,AQID"));assertFalse(gateway.payload.contains("must-not-use-edge"));
        var unknown=new Fake();unknown.models="{\"data\":[{\"id\":\"fixture-model\"}]}";
        assertEquals("ai.pinned_vision_unattested",assertThrows(LlmGateway.PinnedFailure.class,()->unknown.generatePinned(NODE,"Inspect",List.of(new LlmGateway.PinnedImage("image/png",new byte[]{1})))).getMessage());assertEquals(1,unknown.targets.size());
    }
    @Test void unsupportedOrAmbiguousModelNeverCallsCompletion(){
        var absent=new Fake();absent.models="{\"data\":[{\"id\":\"different\"}]}";
        assertEquals("ai.pinned_model_unavailable",assertThrows(LlmGateway.PinnedFailure.class,()->absent.generatePinned(NODE,"Return",List.of())).getMessage());assertEquals(1,absent.targets.size());
        var duplicate=new Fake();duplicate.models="{\"data\":[{\"id\":\"fixture-model\"},{\"id\":\"fixture-model\"}]}";
        assertEquals("ai.pinned_models_protocol",assertThrows(LlmGateway.PinnedFailure.class,()->duplicate.generatePinned(NODE,"Return",List.of())).getMessage());
    }
    @Test void completionMustAttestSameModelAndCompleteJsonObject(){
        var wrong=new Fake();wrong.raw=wrong.raw.replace("fixture-model","different");
        assertEquals("ai.pinned_response_model_mismatch",assertThrows(LlmGateway.PinnedFailure.class,()->wrong.generatePinned(NODE,"Return",List.of())).getMessage());
        var partial=new Fake();partial.raw=partial.raw.replace("\"stop\"","\"length\"");
        assertEquals("ai.pinned_incomplete_response",assertThrows(LlmGateway.PinnedFailure.class,()->partial.generatePinned(NODE,"Return",List.of())).getMessage());
        var nonObject=new Fake();nonObject.raw=nonObject.raw.replace("\"{}\"","\"[]\"");
        assertEquals("ai.pinned_json_object_required",assertThrows(LlmGateway.PinnedFailure.class,()->nonObject.generatePinned(NODE,"Return",List.of())).getMessage());
    }
    @Test void redirectRateAndTransportFailureNeverInvokeFallbackOrPrintBody(){
        for(String code:List.of("ai.pinned_redirect_blocked","ai.pinned_rate_limited","ai.pinned_http_failure")){
            var gateway=new Fake();gateway.transportFailure=code;
            assertEquals(code,assertThrows(LlmGateway.PinnedFailure.class,()->gateway.generatePinned(NODE,"Return",List.of())).getMessage());assertEquals(1,gateway.targets.size());
        }
    }
    @Test void imageAndPromptBudgetsRejectBeforeCompletion(){
        var gateway=new Fake();assertThrows(LlmGateway.PinnedFailure.class,()->gateway.generatePinned(NODE,"x".repeat(100001),List.of()));assertTrue(gateway.targets.isEmpty());
        var image=new LlmGateway.PinnedImage("image/png",new byte[]{1});assertThrows(LlmGateway.PinnedFailure.class,()->gateway.generatePinned(NODE,"Return",List.of(image,image,image,image,image)));assertTrue(gateway.targets.isEmpty());
    }
    @Test void actualSubscriberCancelsOversizedBodiesAndImageBytesCannotMutate() throws Exception {
        var type=Class.forName("com.bobbuy.service.LlmGateway$LimitedJsonSubscriber");var constructor=type.getDeclaredConstructor();constructor.setAccessible(true);
        @SuppressWarnings("unchecked") var subscriber=(java.net.http.HttpResponse.BodySubscriber<byte[]>)constructor.newInstance();
        var cancelled=new java.util.concurrent.atomic.AtomicBoolean();
        subscriber.onSubscribe(new java.util.concurrent.Flow.Subscription(){public void request(long n){}public void cancel(){cancelled.set(true);}});
        subscriber.onNext(List.of(java.nio.ByteBuffer.wrap(new byte[2*1024*1024+1])));
        var failure=assertThrows(java.util.concurrent.ExecutionException.class,()->subscriber.getBody().toCompletableFuture().get());
        assertTrue(cancelled.get());assertEquals("ai.pinned_response_budget",failure.getCause().getMessage());
        byte[] bytes={1,2};var image=new LlmGateway.PinnedImage("image/png",bytes);bytes[0]=9;assertEquals(1,image.bytes()[0]);byte[] exposed=image.bytes();exposed[0]=8;assertEquals(1,image.bytes()[0]);
    }
}
