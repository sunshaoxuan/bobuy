package com.bobbuy.service;

import com.bobbuy.util.EncryptionUtils;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

@Component
public class LlmGateway {
    private static final Logger log = LoggerFactory.getLogger(LlmGateway.class);
    private final ObjectMapper objectMapper;

    // Main Node (Cloud Core) - High performance reasoning
    private final String mainUrl;
    private final String mainModel;
    private final String mainProvider;
    private final String codexCommand;
    private final Duration codexTimeout;
    private final String codexBridgeUrl;
    private final String codexBridgeModel;
    private final String codexBridgeApiKey;
    private final String codexBridgeSecretSalt;
    private final String codexBridgeSecretNonce;
    private final String codexBridgeSecretCiphertext;
    private final String codexBridgeSecretTag;
    private final int codexBridgeSecretIterations;
    private final String aiSecretMasterPassword;
    private final Duration codexBridgeTimeout;
    private final Duration ollamaHealthTimeout;
    private volatile String activeMainProvider;
    private volatile Optional<String> resolvedCodexBridgeApiKey;

    // Edge Node (Local) - Low latency, Vision/OCR
    private final String edgeUrl;
    private final String edgeModel;
    private final String ocrUrl;

    public LlmGateway(ObjectMapper objectMapper,
                      @Value("${bobbuy.ai.llm.main.url:}") String mainUrl,
                      @Value("${bobbuy.ai.llm.main.model:qwen3:14b}") String mainModel,
                      @Value("${bobbuy.ai.llm.main.provider:auto}") String mainProvider,
                      @Value("${bobbuy.ai.llm.codex.command:codex}") String codexCommand,
                      @Value("${bobbuy.ai.llm.codex.timeout-seconds:120}") long codexTimeoutSeconds,
                      @Value("${bobbuy.ai.llm.codex-bridge.url:}") String codexBridgeUrl,
                      @Value("${bobbuy.ai.llm.codex-bridge.model:gpt-5.3-codex}") String codexBridgeModel,
                      @Value("${bobbuy.ai.llm.codex-bridge.api-key:}") String codexBridgeApiKey,
                      @Value("${bobbuy.ai.llm.codex-bridge.timeout-seconds:120}") long codexBridgeTimeoutSeconds,
                      @Value("${bobbuy.ai.llm.codex-bridge.secret.salt:}") String codexBridgeSecretSalt,
                      @Value("${bobbuy.ai.llm.codex-bridge.secret.nonce:}") String codexBridgeSecretNonce,
                      @Value("${bobbuy.ai.llm.codex-bridge.secret.ciphertext:}") String codexBridgeSecretCiphertext,
                      @Value("${bobbuy.ai.llm.codex-bridge.secret.tag:}") String codexBridgeSecretTag,
                      @Value("${bobbuy.ai.llm.codex-bridge.secret.iterations:200000}") int codexBridgeSecretIterations,
                      @Value("${bobbuy.ai.secret.master-password:}") String aiSecretMasterPassword,
                      @Value("${bobbuy.ai.llm.ollama.health-timeout-seconds:3}") long ollamaHealthTimeoutSeconds,
                      @Value("${bobbuy.ai.llm.edge.url:}") String edgeUrl,
                      @Value("${bobbuy.ai.llm.edge.model:llava}") String edgeModel,
                      @Value("${bobbuy.ocr.url:}") String ocrUrl) {
        this.objectMapper = objectMapper;
        this.mainUrl = mainUrl;
        this.mainModel = mainModel;
        this.mainProvider = mainProvider == null || mainProvider.isBlank() ? "auto" : mainProvider.trim().toLowerCase();
        this.codexCommand = codexCommand;
        this.codexTimeout = Duration.ofSeconds(Math.max(1, codexTimeoutSeconds));
        this.codexBridgeUrl = codexBridgeUrl;
        this.codexBridgeModel = codexBridgeModel;
        this.codexBridgeApiKey = codexBridgeApiKey;
        this.codexBridgeTimeout = Duration.ofSeconds(Math.max(1, codexBridgeTimeoutSeconds));
        this.codexBridgeSecretSalt = codexBridgeSecretSalt;
        this.codexBridgeSecretNonce = codexBridgeSecretNonce;
        this.codexBridgeSecretCiphertext = codexBridgeSecretCiphertext;
        this.codexBridgeSecretTag = codexBridgeSecretTag;
        this.codexBridgeSecretIterations = Math.max(10000, codexBridgeSecretIterations);
        this.aiSecretMasterPassword = aiSecretMasterPassword;
        this.ollamaHealthTimeout = Duration.ofSeconds(Math.max(1, ollamaHealthTimeoutSeconds));
        this.edgeUrl = edgeUrl;
        this.edgeModel = edgeModel;
        this.ocrUrl = ocrUrl;
    }

    @PostConstruct
    public void initializeMainProvider() {
        if ("codex-bridge".equals(mainProvider) || "openai-compatible".equals(mainProvider)) {
            activeMainProvider = codexBridgeOrUnconfigured();
        } else if ("codex".equals(mainProvider)) {
            activeMainProvider = codexOrUnconfigured();
        } else if (mainUrl == null || mainUrl.isBlank()) {
            activeMainProvider = codexBridgeThenCodexOrUnconfigured();
        } else {
            activeMainProvider = isOllamaAvailable(mainUrl) ? "ollama" : codexBridgeThenCodexOrUnconfigured();
        }
        log.info("AI main LLM provider initialized: configured={}, active={}, ollamaUrl={}, codexBridgeUrl={}, codexCommand={}",
                mainProvider, activeMainProvider, blankToUnset(mainUrl), blankToUnset(codexBridgeUrl), blankToUnset(codexCommand));
    }

    /**
     * Calls the dedicated Python OCR service.
     */
    public List<String> performOcr(String base64Image) {
        if (ocrUrl == null || ocrUrl.isBlank()) {
            log.warn("OCR service URL is not configured.");
            return List.of();
        }

        try {
            log.info("Calling OCR service at {}...", ocrUrl);
            Map<String, String> payload = Map.of("image", base64Image);
            
            // Use a fresh RestClient and explicit URI
            Map<String, Object> response = RestClient.builder()
                    .baseUrl(ocrUrl)
                    .build()
                    .post()
                    .uri("/ocr")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});

            if (response != null && response.get("results") instanceof List<?> results) {
                log.info("OCR service returned {} lines.", results.size());
                return results.stream()
                        .filter(Map.class::isInstance)
                        .map(m -> (Map<String, Object>) m)
                        .map(m -> (String) m.get("text"))
                        .toList();
            } else {
                log.warn("OCR service returned invalid response format: {}", response);
            }
        } catch (Exception e) {
            log.error("OCR Service call failed: {}", e.getMessage(), e);
        }
        return List.of();
    }

    public Optional<List<Map<String, Object>>> parseItems(String text) {
        if (text == null || text.isBlank() || !isMainLlmConfigured()) {
            return Optional.empty();
        }

        String prompt = "请将输入文本提取为JSON数组，每个对象包含name, quantity, note字段，只输出JSON数组。输入：" + text;
        return generate(prompt, mainModel, null).map(response -> {
            try {
                List<Map<String, Object>> parsed = objectMapper.readValue(response, new TypeReference<>() {});
                return parsed == null ? new ArrayList<>() : parsed;
            } catch (Exception e) {
                log.error("Failed to parse LLM response as JSON: {}", response, e);
                return new ArrayList<>();
            }
        });
    }

    public Optional<String> translate(String text, String targetLocale) {
        if (text == null || text.isBlank() || !isMainLlmConfigured()) {
            return Optional.empty();
        }

        String prompt = String.format("请将以下文本翻译成%s，只输出翻译后的文本，不要有任何额外解释。文本：%s", targetLocale, text);
        return generate(prompt, mainModel, null).map(String::trim);
    }

    /**
     * Intelligent routing between Main and Edge nodes.
     * Vision tasks are pinned to the Edge node.
     * Complex reasoning tasks default to the Main node.
     */
    public Optional<String> generate(String prompt, String targetModel, List<String> base64Images) {
        boolean isVision = (base64Images != null && !base64Images.isEmpty()) || (targetModel != null && targetModel.contains("llava"));

        if(isVision && (edgeUrl==null || edgeUrl.isBlank()) && "codex-bridge".equals(resolveActiveMainProvider())) {
            return generateWithCodexBridge(prompt,targetModel,base64Images);
        }

        if (!isVision && "codex".equals(resolveActiveMainProvider())) {
            return generateWithCodex(prompt);
        }
        if (!isVision && "codex-bridge".equals(resolveActiveMainProvider())) {
            return generateWithCodexBridge(prompt, targetModel);
        }
        
        String url = isVision ? edgeUrl : mainUrl;
        String model = targetModel != null && !targetModel.isBlank() ? targetModel : (isVision ? edgeModel : mainModel);

        if (url == null || url.isBlank()) {
            log.warn("Target LLM URL is not configured (isVision: {})", isVision);
            // Attempt failover to main if edge is missing and it's not strictly vision
            if (isVision || mainUrl.isBlank()) return Optional.empty();
            url = mainUrl;
            model = mainModel;
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", model);
        payload.put("stream", false);
        payload.put("prompt", prompt);
        if (base64Images != null && !base64Images.isEmpty()) {
            payload.put("images", base64Images);
        }

        try {
            log.info("Dispatching LLM task to {} (model: {}, vision: {})", url, model, isVision);
            Map<String, Object> raw = RestClient.create(url)
                    .post()
                    .uri("/api/generate")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});
            
            if (raw == null || !(raw.get("response") instanceof String response) || response.isBlank()) {
                log.warn("LLM Gateway at {} returned an empty response.", url);
                return failoverFromMainEmptyResponse(prompt, targetModel, isVision);
            }
            return Optional.of(response);
        } catch (Exception e) {
            log.error("LLM Gateway error at {}: {}", url, e.getMessage());
            if (!isVision && !"codex-bridge".equals(activeMainProvider) && isCodexBridgeConfigured()) {
                activeMainProvider = "codex-bridge";
                log.info("Ollama main node failed; switching active main LLM provider to Codex Bridge.");
                return generateWithCodexBridge(prompt, targetModel);
            }
            if (!isVision && !"codex".equals(activeMainProvider) && isCodexConfigured()) {
                activeMainProvider = "codex";
                log.info("Ollama main node failed; switching active main LLM provider to Codex.");
                return generateWithCodex(prompt);
            }
            return Optional.empty();
        }
    }

    private Optional<String> failoverFromMainEmptyResponse(String prompt, String targetModel, boolean isVision) {
        if (isVision) {
            return Optional.empty();
        }
        if (!"codex-bridge".equals(activeMainProvider) && isCodexBridgeConfigured()) {
            activeMainProvider = "codex-bridge";
            log.info("Main LLM returned an empty response; switching active main LLM provider to Codex Bridge.");
            return generateWithCodexBridge(prompt, targetModel);
        }
        if (!"codex".equals(activeMainProvider) && isCodexConfigured()) {
            activeMainProvider = "codex";
            log.info("Main LLM returned an empty response; switching active main LLM provider to Codex CLI.");
            return generateWithCodex(prompt);
        }
        return Optional.empty();
    }

    private boolean isMainLlmConfigured() {
        if ("codex-bridge".equals(resolveActiveMainProvider())) {
            return isCodexBridgeConfigured();
        }
        if ("codex".equals(resolveActiveMainProvider())) {
            return isCodexConfigured();
        }
        if ("unconfigured".equals(resolveActiveMainProvider())) {
            return false;
        }
        return mainUrl != null && !mainUrl.isBlank();
    }

    private String resolveActiveMainProvider() {
        if (activeMainProvider == null || activeMainProvider.isBlank()) {
            initializeMainProvider();
        }
        return activeMainProvider;
    }

    private boolean isOllamaAvailable(String url) {
        if (url == null || url.isBlank()) {
            return false;
        }
        try {
            SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
            requestFactory.setConnectTimeout(ollamaHealthTimeout);
            requestFactory.setReadTimeout(ollamaHealthTimeout);
            Map<String, Object> raw = RestClient.builder()
                    .baseUrl(url)
                    .requestFactory(requestFactory)
                    .build()
                    .get()
                    .uri("/api/tags")
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});
            return raw != null;
        } catch (Exception e) {
            log.warn("Ollama main node is unavailable at {}: {}", url, e.getMessage());
            return false;
        }
    }

    private boolean isCodexConfigured() {
        return isCodexCommandAvailable();
    }

    private boolean isCodexCommandAvailable() {
        if (codexCommand == null || codexCommand.isBlank()) {
            return false;
        }
        String commandName = codexCommand.trim().split("\\s+")[0];
        Path commandPath = Path.of(commandName);
        if (commandPath.isAbsolute() || commandName.contains("/") || commandName.contains("\\")) {
            return Files.isExecutable(commandPath);
        }
        String path = System.getenv("PATH");
        if (path == null || path.isBlank()) {
            return false;
        }
        for (String entry : path.split(java.io.File.pathSeparator)) {
            if (entry == null || entry.isBlank()) {
                continue;
            }
            Path candidate = Path.of(entry, commandName);
            if (Files.isExecutable(candidate)) {
                return true;
            }
            if (System.getProperty("os.name", "").toLowerCase().contains("win")) {
                Path cmdCandidate = Path.of(entry, commandName + ".cmd");
                Path exeCandidate = Path.of(entry, commandName + ".exe");
                if (Files.isExecutable(cmdCandidate) || Files.isExecutable(exeCandidate)) {
                    return true;
                }
            }
        }
        return false;
    }

    private boolean isCodexBridgeConfigured() {
        return secureBridgeUrl() && resolveCodexBridgeApiKey().isPresent();
    }

    private boolean secureBridgeUrl() {
        try{var uri=URI.create(codexBridgeUrl);String host=uri.getHost();return host!=null&&uri.getUserInfo()==null&&uri.getRawQuery()==null&&uri.getRawFragment()==null&&("https".equals(uri.getScheme())||"http".equals(uri.getScheme())&&java.util.Set.of("127.0.0.1","localhost","[::1]","::1").contains(host));}
        catch(Exception error){return false;}
    }

    private boolean isCodexBridgeAvailable() {
        if(!secureBridgeUrl())return false;
        Optional<String> apiKey = resolveCodexBridgeApiKey();
        if (codexBridgeUrl == null || codexBridgeUrl.isBlank() || apiKey.isEmpty()) {
            return false;
        }
        try {
            SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
            requestFactory.setConnectTimeout(codexBridgeTimeout);
            requestFactory.setReadTimeout(codexBridgeTimeout);
            Map<String, Object> raw = RestClient.builder()
                    .requestFactory(requestFactory)
                    .build()
                    .get()
                    .uri(URI.create(trimTrailingSlash(codexBridgeUrl) + "/models"))
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey.get())
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});
            return raw != null;
        } catch (Exception e) {
            log.warn("Codex Bridge is unavailable at {}: {}", codexBridgeUrl, e.getMessage());
            return false;
        }
    }

    private String codexBridgeThenCodexOrUnconfigured() {
        if (isCodexBridgeAvailable()) {
            return "codex-bridge";
        }
        return codexOrUnconfigured();
    }

    private String codexBridgeOrUnconfigured() {
        return isCodexBridgeAvailable() ? "codex-bridge" : "unconfigured";
    }

    private String codexOrUnconfigured() {
        return isCodexConfigured() ? "codex" : "unconfigured";
    }

    public String getActiveMainProvider() {
        return resolveActiveMainProvider();
    }

    public String getMainModel() {
        if ("codex-bridge".equals(resolveActiveMainProvider())) {
            return codexBridgeModel;
        }
        return mainModel;
    }

    public String getEdgeModel() {
        return edgeModel;
    }

    public String getEdgeProvider() {
        return edgeUrl == null || edgeUrl.isBlank() ? "unconfigured" : "ollama-compatible";
    }

    public String getOcrProvider() {
        return ocrUrl == null || ocrUrl.isBlank() ? "unconfigured" : "python-ocr";
    }

    private String blankToUnset(String value) {
        return value == null || value.isBlank() ? "<unset>" : value;
    }

    private Optional<String> generateWithCodex(String prompt) {
        if (codexCommand == null || codexCommand.isBlank()) {
            log.warn("Codex command is not configured.");
            return Optional.empty();
        }

        List<String> command = new ArrayList<>();
        command.add(codexCommand);
        command.add("exec");
        command.add("--skip-git-repo-check");
        command.add(prompt);

        Path outputFile = null;
        try {
            outputFile = Files.createTempFile("bobbuy-codex-", ".out");
            log.info("Dispatching LLM task to Codex subscription via {}", codexCommand);
            Process process = new ProcessBuilder(command)
                    .redirectOutput(outputFile.toFile())
                    .redirectErrorStream(true)
                    .start();

            boolean finished = process.waitFor(codexTimeout.toSeconds(), TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                log.error("Codex command timed out after {} seconds.", codexTimeout.toSeconds());
                return Optional.empty();
            }

            String output = Files.readString(outputFile, StandardCharsets.UTF_8).trim();

            if (process.exitValue() != 0) {
                log.error("Codex command failed with exit code {}: {}", process.exitValue(), output);
                return Optional.empty();
            }

            return output.isBlank() ? Optional.empty() : Optional.of(output);
        } catch (Exception e) {
            log.error("Codex Gateway error: {}", e.getMessage(), e);
            return Optional.empty();
        } finally {
            if (outputFile != null) {
                try {
                    Files.deleteIfExists(outputFile);
                } catch (Exception ignored) {
                    // Best-effort cleanup for transient command output.
                }
            }
        }
    }

    private Optional<String> generateWithCodexBridge(String prompt, String targetModel) {
        return generateWithCodexBridge(prompt,targetModel,null);
    }

    private Optional<String> generateWithCodexBridge(String prompt, String targetModel,List<String> images) {
        if(!secureBridgeUrl())return Optional.empty();
        Optional<String> apiKey = resolveCodexBridgeApiKey();
        if (codexBridgeUrl == null || codexBridgeUrl.isBlank() || apiKey.isEmpty()) {
            log.warn("Codex Bridge is not configured.");
            return Optional.empty();
        }

        String model = targetModel != null && !targetModel.isBlank() ? targetModel : codexBridgeModel;
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", model);
        payload.put("stream", false);
        if(images!=null&&!images.isEmpty()){
            var content=new java.util.ArrayList<Map<String,Object>>();content.add(Map.of("type","text","text",prompt));
            for(String image:images)content.add(Map.of("type","image_url","image_url",Map.of("url",image.startsWith("data:")?image:"data:image/png;base64,"+image)));
            payload.put("messages",List.of(Map.of("role","user","content",content)));
        }else payload.put("messages", List.of(Map.of("role", "user", "content", prompt)));

        try {
            SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
            requestFactory.setConnectTimeout(codexBridgeTimeout);
            requestFactory.setReadTimeout(codexBridgeTimeout);
            String requestBody = objectMapper.writeValueAsString(payload);
            log.info("Dispatching LLM task to Codex Bridge at {} (model: {})", codexBridgeUrl, model);
            Map<String, Object> raw = RestClient.builder()
                    .requestFactory(requestFactory)
                    .build()
                    .post()
                    .uri(URI.create(trimTrailingSlash(codexBridgeUrl) + "/chat/completions"))
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey.get())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .body(new ParameterizedTypeReference<Map<String, Object>>() {});

            return extractOpenAiCompatibleContent(raw);
        } catch (Exception e) {
            log.error("Codex Bridge Gateway error: {}", e.getMessage());
            if (isCodexConfigured()) {
                activeMainProvider = "codex";
                log.info("Codex Bridge failed; switching active main LLM provider to Codex CLI.");
                return generateWithCodex(prompt);
            }
            return Optional.empty();
        }
    }

    private Optional<String> extractOpenAiCompatibleContent(Map<String, Object> raw) {
        if (raw == null || !(raw.get("choices") instanceof List<?> choices) || choices.isEmpty()) {
            return Optional.empty();
        }
        Object firstChoice = choices.get(0);
        if (!(firstChoice instanceof Map<?, ?> choice)) {
            return Optional.empty();
        }
        Object message = choice.get("message");
        if (message instanceof Map<?, ?> messageMap) {
            Optional<String> content = extractOpenAiContentValue(messageMap.get("content"));
            if (content.isPresent()) {
                return content;
            }
        }
        Object text = choice.get("text");
        if (text instanceof String content && !content.isBlank()) {
            return Optional.of(content);
        }
        return Optional.empty();
    }

    private Optional<String> extractOpenAiContentValue(Object contentValue) {
        if (contentValue instanceof String content && !content.isBlank()) {
            return Optional.of(content);
        }
        if (contentValue instanceof List<?> parts && !parts.isEmpty()) {
            StringBuilder text = new StringBuilder();
            for (Object part : parts) {
                if (part instanceof Map<?, ?> partMap) {
                    Object textValue = partMap.get("text");
                    if (textValue instanceof String partText && !partText.isBlank()) {
                        if (!text.isEmpty()) {
                            text.append('\n');
                        }
                        text.append(partText);
                    }
                }
            }
            if (!text.isEmpty()) {
                return Optional.of(text.toString());
            }
        }
        return Optional.empty();
    }

    private Optional<String> resolveCodexBridgeApiKey() {
        Optional<String> cached = resolvedCodexBridgeApiKey;
        if (cached != null) {
            return cached;
        }
        synchronized (this) {
            if (resolvedCodexBridgeApiKey != null) {
                return resolvedCodexBridgeApiKey;
            }
            resolvedCodexBridgeApiKey = loadCodexBridgeApiKey();
            return resolvedCodexBridgeApiKey;
        }
    }

    private Optional<String> loadCodexBridgeApiKey() {
        if (codexBridgeApiKey != null && !codexBridgeApiKey.isBlank()) {
            return Optional.of(codexBridgeApiKey);
        }
        if (!hasEncryptedCodexBridgeSecret()) {
            return Optional.empty();
        }
        if (aiSecretMasterPassword == null || aiSecretMasterPassword.isBlank()) {
            log.warn("Codex Bridge encrypted API key is configured, but bobbuy.ai.secret.master-password is empty.");
            return Optional.empty();
        }
        try {
            String decrypted = EncryptionUtils.decrypt(
                    aiSecretMasterPassword,
                    codexBridgeSecretSalt,
                    codexBridgeSecretNonce,
                    codexBridgeSecretCiphertext,
                    codexBridgeSecretTag,
                    codexBridgeSecretIterations
            );
            return decrypted == null || decrypted.isBlank() ? Optional.empty() : Optional.of(decrypted);
        } catch (Exception e) {
            log.error("Failed to decrypt Codex Bridge API key: {}", e.getMessage());
            return Optional.empty();
        }
    }

    private boolean hasEncryptedCodexBridgeSecret() {
        return codexBridgeSecretSalt != null && !codexBridgeSecretSalt.isBlank()
                && codexBridgeSecretNonce != null && !codexBridgeSecretNonce.isBlank()
                && codexBridgeSecretCiphertext != null && !codexBridgeSecretCiphertext.isBlank()
                && codexBridgeSecretTag != null && !codexBridgeSecretTag.isBlank();
    }

    private String trimTrailingSlash(String value) {
        if (value == null) {
            return "";
        }
        String trimmed = value.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }
}
