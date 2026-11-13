package com.bobbuy.service;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/** Configuration-only model catalogue. Model identifiers must not be added to routing code. */
@Component
@ConfigurationProperties(prefix = "bobbuy.ai.bridge-routing")
public class BridgeRoutingProperties {
    public enum Task { VISION_EXTRACTION, TEXT_ANALYSIS, BATCH_TEXT }
    public static class Model {
        private String id;
        private Duration timeout = Duration.ofSeconds(60);
        private int retries = 1;
        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public Duration getTimeout() { return timeout; }
        public void setTimeout(Duration timeout) { this.timeout = timeout; }
        public int getRetries() { return retries; }
        public void setRetries(int retries) { this.retries = Math.max(0, retries); }
    }

    private boolean enabled;
    private String url;
    private String apiKey;
    private int failureThreshold = 2;
    private Duration cooldown = Duration.ofMinutes(5);
    private boolean imageGenerationEnabled;
    private String imageGenerationModel;
    private Map<Task, List<Model>> routes = new EnumMap<>(Task.class);
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }
    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }
    public int getFailureThreshold() { return failureThreshold; }
    public void setFailureThreshold(int value) { failureThreshold = Math.max(1, value); }
    public Duration getCooldown() { return cooldown; }
    public void setCooldown(Duration cooldown) { this.cooldown = cooldown; }
    public boolean isImageGenerationEnabled() { return imageGenerationEnabled; }
    public void setImageGenerationEnabled(boolean value) { imageGenerationEnabled = value; }
    public String getImageGenerationModel() { return imageGenerationModel; }
    public void setImageGenerationModel(String value) { imageGenerationModel = value; }
    public Map<Task, List<Model>> getRoutes() { return routes; }
    public void setRoutes(Map<Task, List<Model>> routes) { this.routes = routes == null ? new EnumMap<>(Task.class) : routes; }
    public List<Model> models(Task task) { return new ArrayList<>(routes.getOrDefault(task, List.of())); }
}
