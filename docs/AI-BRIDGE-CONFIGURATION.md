# AI / OCR Codex Bridge production configuration

The production router is opt-in (`BOBBUY_AI_BRIDGE_ROUTING_ENABLED=false` by default). It keeps the existing local-provider and manual-review fallbacks when disabled or when every configured Bridge model fails.

## Secrets

Provide `BOBBUY_AI_LLM_CODEX_BRIDGE_API_KEY` only through the runtime environment or the SOPS + age encrypted deployment secret described by the repository secret-management process. Never place a decrypted value in Git, logs, command arguments, or configuration files. The application logs only the selected model identifier and aggregate event names; request content and authorization values are excluded.

## Routing

The ordered task routes and every model identifier live under `bobbuy.ai.bridge-routing.routes` in `backend/src/main/resources/application.yml`. Each entry has independent `timeout` and `retries` values. Change ordering in configuration, not Java. The image-generation slot is present but disabled.

`failure-threshold` controls consecutive failures and `cooldown` controls how long an opened model circuit is skipped. HTTP 402/429 responses open the affected model immediately. Invalid structured results count as failures and move to the next model. Exhausting the route returns no AI result so callers retain their retry/manual-review behavior.

The router exposes metadata-only counters for calls, failures, validation failures, circuit openings, cooldown skips, fallback transitions, and manual-review exhaustion. Brave search is independently guarded by `BOBBUY_AI_SEARCH_BRAVE_ENABLED` and is off by default.

## Testing

`CodexBridgeRouterTest` supplies an in-memory `CodexBridgeTransport`; it validates order, schema rejection fallback, circuit cooldown, and route exhaustion without DNS or network access. Keep CI credentials empty and routing disabled except in tests that inject this mock boundary.
