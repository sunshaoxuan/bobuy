# Codex Bridge review fixes

## Goal and scope
Fix the three reported review findings with minimal changes. Do not commit or deploy.
Use the existing production workflow only for scope and evidence discipline.

## Implementation and acceptance
1. Annotate the router DI constructor; verify Spring creates the bean with routing disabled and enabled.
2. Normalize raw base64 images into PNG data URLs; recognize JPEG/WebP signatures and preserve existing data/HTTP(S) URLs. Verify the actual HTTP request payload.
3. Preserve the routing key override and reuse LlmGateway's cached encrypted-key resolver through deferred lookup, avoiding a dependency cycle. Verify encrypted credentials reach the authorization header and missing credentials fail closed. Never log secrets.

## Frozen validation scope
Paths: CodexBridgeRouter.java, OpenAiCodexBridgeTransport.java, LlmGateway.java, corresponding CodexBridge*/OpenAiCodexBridge* tests, and this record.
Direct consumers: Spring bean wiring and bridge completion requests.
Checks: diff whitespace check and `mvn -q -pl backend -am test -Dtest='CodexBridge*,OpenAiCodexBridge*,LlmGateway*' -Dsurefire.failIfNoSpecifiedTests=false`.
Expected duration: 2 to 5 minutes, depending on existing dependencies. Track the same process if slower. Stop after required checks pass; no full-product tests, UI changes, external-model delegation, or production operations.
These are bounded wiring, request formatting, and credential reuse corrections handled by the main agent.

## Results
Implementation complete. The root aggregator does not include backend; use equivalent `-f backend/pom.xml` with the requested test selector.
First Maven invocation stopped before compilation because PowerShell split an unquoted `-Dsurefire.failIfNoSpecifiedTests=false` argument. Quote the complete argument and retry the same scoped command; no test evidence exists to reuse. Whitespace check passed.

Final command: Maven 3.9.9 with JAVA_HOME pointing to JDK 22, `mvn.cmd -q -f backend/pom.xml test '-Dtest=CodexBridge*,OpenAiCodexBridge*,LlmGateway*' '-Dsurefire.failIfNoSpecifiedTests=false'`. Exit code 0.
19 tests passed, zero failures/errors/skips: CodexBridgeRouterTest 3, OpenAiCodexBridgeTransportTest 4, LlmGatewayTest 4, LlmGatewayPinnedTest 8. Evidence: backend/target/surefire-reports for these four classes.

Acceptance: Spring construction with enabled/disabled routing PASS; actual HTTP image payload normalization and URL preservation PASS; encrypted credential authentication through the real router/transport/gateway bean graph PASS; explicit routing key precedence and missing-credential rejection PASS. Credential decryption errors now log a fixed message without exception content.
Final scope review: only the three production classes, one new test class, and this record changed. No commit, deployment, UI work, or extra test suite. No task-specific temporary scripts or fixtures remain; standard Maven outputs retain test evidence.
