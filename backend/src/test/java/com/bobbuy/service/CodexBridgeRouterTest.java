package com.bobbuy.service;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

class CodexBridgeRouterTest {
    @Test void invalidStructuredOutputFallsBackInConfiguredOrder() {
        var properties=properties("vision-a","vision-b"); var calls=new ArrayList<String>();
        CodexBridgeTransport bridge=(model,prompt,images,timeout)->{calls.add(model);return new CodexBridgeTransport.Reply(model.equals("vision-a")?"not-json":"{\"ok\":true}",model);};
        var router=new CodexBridgeRouter(properties,bridge);
        var result=router.route(BridgeRoutingProperties.Task.VISION_EXTRACTION,"synthetic",List.of("data:image/png;base64,eA=="),value->value.startsWith("{"));
        assertThat(result).get().extracting(CodexBridgeRouter.Result::model).isEqualTo("vision-b");
        assertThat(calls).containsExactly("vision-a","vision-b"); assertThat(router.metric("fallbacks")).isEqualTo(1);
    }

    @Test void quotaFailureOpensCircuitAndSkipsModelDuringCooldown() {
        var properties=properties("primary","fallback"); var primaryCalls=new AtomicInteger();
        CodexBridgeTransport bridge=(model,prompt,images,timeout)->{if(model.equals("primary")){primaryCalls.incrementAndGet();throw new CodexBridgeTransport.Failure(true);}return new CodexBridgeTransport.Reply("ok",model);};
        var router=new CodexBridgeRouter(properties,bridge);
        assertThat(router.route(BridgeRoutingProperties.Task.VISION_EXTRACTION,"one",List.of(),value->true)).isPresent();
        assertThat(router.route(BridgeRoutingProperties.Task.VISION_EXTRACTION,"two",List.of(),value->true)).isPresent();
        assertThat(primaryCalls).hasValue(1); assertThat(router.metric("circuit_opens")).isEqualTo(1); assertThat(router.metric("cooldown_skips")).isEqualTo(1);
    }

    @Test void retriesTransportFailureThenUsesManualReviewWhenEveryModelFails() {
        var properties=properties("only"); properties.models(BridgeRoutingProperties.Task.VISION_EXTRACTION).get(0).setRetries(1);
        var calls=new AtomicInteger(); CodexBridgeTransport bridge=(model,prompt,images,timeout)->{calls.incrementAndGet();throw new CodexBridgeTransport.Failure(false);};
        var router=new CodexBridgeRouter(properties,bridge);
        assertThat(router.route(BridgeRoutingProperties.Task.VISION_EXTRACTION,"synthetic",List.of(),value->true)).isEmpty();
        assertThat(calls).hasValue(2); // one configured retry, then manual review
        assertThat(router.metric("manual_review")).isEqualTo(1);
    }

    private static BridgeRoutingProperties properties(String... ids) {
        var value=new BridgeRoutingProperties(); value.setEnabled(true); value.setFailureThreshold(1); value.setCooldown(Duration.ofMinutes(5));
        var models=new ArrayList<BridgeRoutingProperties.Model>(); for(String id:ids){var model=new BridgeRoutingProperties.Model();model.setId(id);model.setRetries(0);models.add(model);}
        var routes=new EnumMap<BridgeRoutingProperties.Task,List<BridgeRoutingProperties.Model>>(BridgeRoutingProperties.Task.class);routes.put(BridgeRoutingProperties.Task.VISION_EXTRACTION,models);value.setRoutes(routes);return value;
    }
}
