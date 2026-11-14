# Recommendation repair assistant — 2026-11-14

## Authorized scope

## PR 116 review repair, 2026-11-15

Goal: resolve issue 115 review defects on this branch. No merge, production writes, hash algorithm changes, or new publication gates. Preserve artifact privacy and blank-only defaults.
Frozen scope: repair service/controller, frontend repair API caller, focused backend and frontend tests, and this task record. Bind source confirmation to exact preview rows and product versions; preserve stale translation provenance; install Japanese fields before hashing; deduplicate suggestions; return INVALID_REQUEST for unconfirmed requests; use known supplier fallbacks only.
Method: implement one bounded batch, then run RecommendationRepairServiceTest and new controller tests, new frontend tests, and TypeScript check. Expected checks: 2 to 5 minutes each. Stop after scoped checks; sandbox esbuild EPERM is recorded for outside-sandbox rerun. No full-stack startup or unrelated checks. UI appearance is unchanged; frontend change only transports the reviewed snapshot. Existing UI acceptance requirements above remain applicable to visual changes.
Acceptance: each reported defect has a regression assertion; no artifact bytes in serialized previews; stale candidate rejection occurs before writes; test outcomes recorded below.

Validation update: initial backend compile and 15 focused tests passed. Concrete remaining defect: locale apply still accepts overwriting nonblank text. Add a nonblank guard (identical submitted values may attest review), plus regression coverage for blank-only and absent stale provenance. Invalidated input: RecommendationRepairService and its tests; rerun only RecommendationRepairServiceTest. Controller HTTP 400 PASS remains reusable.

Frontend environment: checkout initially had no node_modules. Offline npm ci failed at lifecycle subprocess spawn EPERM and removed Vitest/TypeScript; direct test/typecheck attempts reported MODULE_NOT_FOUND. Install cached dependencies with lifecycle scripts disabled, then attempt the same focused checks once. This changes installation conditions only, not source or test policy; no full suite or alternative sandbox execution.

Implement server-derived source-context previews and confirmed batch application, editable AI locale suggestions through `LlmGateway.translate`, one-click entry points from publication failures, and the related UI/UX guidance. Source artifacts remain private; unknown business facts remain blank. This change does not alter publication gates, hashes, historical/production data, or deployment state.

## Change and minimum verification map

| Change | Minimum verification |
| --- | --- |
| Source preview/apply service and API | Focused service/controller tests: multi-item preview, cancellation/no write, supplier-only preservation, artifact response redaction, version conflict |
| Locale suggestion/confirm service and API | Focused service tests: label/edit/confirm, failure remains blank, current provenance preserved and stale provenance stays stale when only filling blanks; unchanged review timestamp |
| Repair modal, failure-panel and batch entry points | Focused Vitest component/API tests, TypeScript check, Playwright 390×844 and 1280×800 screenshots plus computed styles |
| UI/UX rules | Diff/static review |

## §8 / §9 acceptance

The changed UI must reuse existing tokens/components; expose keyboard/focus/hover states and labels; use at least 44px touch targets; keep four-locale text readable without horizontal overflow at the 767px breakpoint and 390px viewport; and keep an actively repaired card full-width where necessary. Browser evidence must cover source derivation (including an unresolved field), supplier-only repair, editable/confirmed AI suggestions, and the publication-panel one-click action at 390×844 and 1280×800. Record computed width, height, min-width, min-height, border radius/color/width, background color, and box shadow for the key controls.

## PR 116 final review evidence

- PASS: project main/test compilation; `mvn -o -Dtest=RecommendationRepairServiceTest test`, 16 tests, 0 failures/errors, 26.969 seconds. Covers stale/null/current provenance, new Japanese fields with reviewed and unreviewed prior translations, description provenance, blank-only writes, distinct AI suggestions, no suggestion-time writes, AI failure, supplier fallback, product-version/derived-value conflicts, private artifact serialization, and confirmed supplier-only repair.
- PASS reused: `RecommendationRepairControllerTest`, 1 test exercising both unconfirmed endpoints through MockMvc, HTTP 400 INVALID_REQUEST and no service invocation. Initial combined run completed in 41.090 seconds.
- PASS: `node node_modules/typescript/bin/tsc --noEmit` (7.86 seconds).
- BLOCKED: `node node_modules/vitest/vitest.mjs run src/components/RecommendationRepairAssistant.test.tsx src/pages/RecommendationsItemPublication.test.tsx src/recommendationPublicationApi.test.ts`. esbuild `ensureServiceIsRunning` raised `spawn EPERM` while loading vitest.config.ts, before test execution. Rerun this exact command from frontend outside the sandbox. Added batch confirm/cancel, supplier-only, editable AI label, failure, stale confirmation, missing-panel one-click, and snapshot payload tests. Existing Select mock is retained; tests do not open Ant Design Select dropdowns.
- Browser runtime acceptance remains unverified in this sandbox. No visible layout/style changes were made; the frontend production change transports the displayed preview to apply. No visual PASS is claimed.
- External Claude advisory review completed through the existing Sub2API runner. Relevant advice incorporated: deterministic snapshot equality, transactional rejection before writes, and product locking during source confirmation. No provider configuration changed.
- Final scope review: no production write, merge, deployment, hash algorithm change, or added publication gate. Changes remain local on this branch. No independent temporary scripts or screenshots created; installed dependencies and native Maven outputs remain available for the outside-sandbox checks. Overall acceptance remains pending the focused frontend run.
