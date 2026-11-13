package com.bobbuy.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.LongAdder;
import java.util.function.Predicate;

/** Ordered fallback, per-model circuit breaking, validation, and metadata-only observability. */
@Component
public class CodexBridgeRouter {
    private static final Logger log = LoggerFactory.getLogger(CodexBridgeRouter.class);
    private record Circuit(int failures, Instant blockedUntil) {}
    public record Result(String content, String model) {}
    private final BridgeRoutingProperties properties;
    private final CodexBridgeTransport transport;
    private final Clock clock;
    private final Map<String, Circuit> circuits = new ConcurrentHashMap<>();
    private final Map<String, LongAdder> metrics = new ConcurrentHashMap<>();
    @Autowired
    public CodexBridgeRouter(BridgeRoutingProperties properties, CodexBridgeTransport transport) { this(properties, transport, Clock.systemUTC()); }
    CodexBridgeRouter(BridgeRoutingProperties properties, CodexBridgeTransport transport, Clock clock) { this.properties=properties;this.transport=transport;this.clock=clock; }

    public Optional<Result> route(BridgeRoutingProperties.Task task, String prompt, List<String> images, Predicate<String> validator) {
        if (!properties.isEnabled() || prompt == null || prompt.isBlank()) return Optional.empty();
        List<BridgeRoutingProperties.Model> models = properties.models(task);
        for (int index=0; index<models.size(); index++) {
            var model=models.get(index); if (model.getId()==null || model.getId().isBlank() || cooling(model.getId())) { increment("cooldown_skips"); continue; }
            if (index>0) increment("fallbacks");
            for (int attempt=0; attempt<=model.getRetries(); attempt++) {
                increment("calls");
                try {
                    var reply=transport.complete(model.getId(), prompt, images == null ? List.of() : images, model.getTimeout());
                    if (!model.getId().equals(reply.model()) || !validator.test(reply.content())) { increment("validation_failures"); fail(model.getId(), false); break; }
                    circuits.remove(model.getId()); log.info("Codex Bridge request served by model={}", model.getId());
                    return Optional.of(new Result(reply.content(), model.getId()));
                } catch (CodexBridgeTransport.Failure failure) { increment("failures"); fail(model.getId(), failure.quota()); if (failure.quota()) break; }
            }
        }
        increment("manual_review"); return Optional.empty();
    }
    public long metric(String name) { var value=metrics.get(name); return value==null?0:value.sum(); }
    public boolean enabled() { return properties.isEnabled(); }
    private boolean cooling(String model) { var state=circuits.get(model); return state!=null && state.blockedUntil()!=null && state.blockedUntil().isAfter(clock.instant()); }
    private void fail(String model, boolean quota) {
        circuits.compute(model,(key,old)->{int failures=old==null?1:old.failures()+1; if(quota||failures>=properties.getFailureThreshold()){
            increment("circuit_opens"); return new Circuit(failures,clock.instant().plus(properties.getCooldown()));} return new Circuit(failures,null);});
    }
    private void increment(String name) { metrics.computeIfAbsent(name,key->new LongAdder()).increment(); }
}
