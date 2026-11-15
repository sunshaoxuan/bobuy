# Recommendation repair assistant — 2026-11-14

## Authorized scope

## Issue 117 / PR 118 repair batch, 2026-11-15

Goal: complete the user-facing merge review on issue-117-repair-modal-user-facing without committing, publishing, production writes, artifact disclosure, hash changes or gate changes. Preserve explicit save confirmation, blank-only defaults, merchant isolation and post/product version checks.

Frozen scope: repair service and focused tests; repair modal and tests; four locale resources; recommendation card checkbox and modal CSS; revert the unrelated catalog review-bar change; UI/UX section 14 and this record. Direct consumers are source preview/confirmation and recommendation publication controls. Original suggestions must survive rejection, groups share eligible suggestions, pasted HTTPS URLs bind to the draft, retained values remain readable, and empty fields never claim AI provenance. AI extraction uses existing routing with source-grounded validation only.

Minimum checks: backend repair service/controller tests (about 1 minute), frontend repair/publication/CSS tests (about 1 minute), TypeScript and i18n checks (about 15 seconds), diff accuracy/scope review. Runtime targets: 390x844 and 1280x800, close target 44x44, card checkbox wrapper height/min-height >=44, 6px action gaps, glyph margins >=3px and center error <=min(2px,10% glyph height). Follow section 8 acceptance recorded below. If Vitest fails with esbuild spawn EPERM, stop runtime checks and report the unverified browser/visual requirements; do not retry or start a separate stack. No full suite. Reuse unchanged checks; document any affected rerun here.

### Issue 117 results

- Implemented: value-based post ID comparison; rejected fields remain unchanged; operator HTTPS URL edits accepted with host/no-userinfo validation; post/product identity and version checks, merchant scope and overwrite guard retained. Save validation does not regenerate AI suggestions. Backend campaign display uses a semantic code and retained supplier/channel/URL displays use the retained value.
- Implemented: original suggestions separate from editable drafts; shared-suggestion groups with counts and group/global restore; per-item URL editing/rejection; manual URL labels and no AI tags on empty fields. AI extraction uses existing LlmGateway routing, accepts only source-present URLs and source-quoted channel evidence, and leaves unverifiable answers blank. No artifact content is returned in previews.
- Implemented: actual `.rec-product .ant-checkbox-wrapper` minimum height, preserved 767px close-button 44x44 rule, reverted the unrelated catalog review-bar addition, synchronized new four-language strings, retained and clarified UI/UX section 14.
- PASS: `mvn.cmd -o -Dtest=RecommendationRepairServiceTest,RecommendationRepairControllerTest test`, 22 tests, 0 failures/errors, 1:02 total. Covers ID 128, rejected fields, pasted/invalid URLs, overwrite guard, source-grounded AI and no regeneration on apply, plus existing version/confidentiality/confirmation tests.
- PASS: `node node_modules/typescript/bin/tsc --noEmit`; `node scripts/check-i18n.mjs`, 1764 keys and missing-key negative fixture. Initial i18n attempt lacked TypeScript; this dependency failure was resolved by one offline, lifecycle-disabled install. No source check was redundantly repeated.
- BLOCKED before execution: `node node_modules/vitest/vitest.mjs run src/components/RecommendationRepairAssistant.test.tsx src/pages/RecommendationsItemPublication.test.tsx src/recommendations.css.test.js` failed loading vitest.config.ts with esbuild `spawn EPERM`. No retry or workaround. Component assertions and CSS contracts are added and compile, but their runtime results remain unverified.
- UNVERIFIED: browser interactions, 390/1280 screenshots, computed hit-area/glyph geometry, console/network checks and Gemini screenshot review. Overall UI acceptance remains pending. AI source extraction is unit-tested with synthetic responses; live production routing was not invoked.
- External design advice: discovered the live model catalog and obtained a response from `claude-opus-5-5-high`. Incorporated value-based identity, transactional version/ownership checks, field allowlist and rejection semantics; no new token/signature/hash mechanism or provider configuration change.
- Final scope: no commit, production write, publication gate change or hash algorithm change. Only the bounded repair paths are changed. The task editing script is removed; installed dependencies and native test outputs are retained for the pending focused validation without reinstalling/recompiling.

## PR 116 visual correction, 2026-11-15

Goal: make every product card containing publication failures span the complete grid at all breakpoints, remove the ineffective portaled-modal ancestor selector, and localize the known unresolved-reason flag in four locales. Preserve all product behavior. No commit or deployment; preserve the existing untracked visual-publication.html and visual-publication.tsx.

Frozen paths: recommendations.css, RecommendationRepairAssistant.tsx and its test, four locale files, a focused CSS contract test, and this record. Direct consumers: publication failure cards and source repair previews. Add a top-level grid-span rule and translate the server flag at display time. Minimum checks: diff whitespace/static scope review, i18n validation, focused CSS/component/publication Vitest tests (expected under one minute). If Vitest encounters esbuild spawn EPERM, report it and stop as requested; do not retry or bypass the sandbox. Browser acceptance at 390×844 and 1280×800 remains pending in that case. No full suite, installation, build, or stack startup.

Acceptance budgets: failure cards span columns 1 / -1; action targets remain at least 44px high with wrapping text and no horizontal overflow at both viewports. Standard acceptance from docs/ui-ux-guidelines.md §8: functional requirements and visual quality both apply; reuse existing tokens/components, consistent heights/radii/spacing; preserve hover/focus/active states, keyboard access, labels and contrast; four-locale long text must not overflow or overlap; attach changed-region screenshots at 390px and 1280px; wrap at 767px and 390px; run only the minimum related tests and report PR checks separately. No visual PASS without actual runtime screenshots.

Results: `git diff --check` passed; `node scripts/check-i18n.mjs` passed (1738 keys, references and negative fixture). Focused command `node node_modules/vitest/vitest.mjs run src/recommendations.css.test.js src/components/RecommendationRepairAssistant.test.tsx src/pages/RecommendationsItemPublication.test.tsx` stopped before tests while loading vitest.config.ts: esbuild ensureServiceIsRunning raised `spawn EPERM`. Verification stopped per user instruction, without retries. Runtime layout, screenshots, console/network checks and external visual review remain unverified; overall visual acceptance is pending. Existing 44px minimums and text wrapping are preserved. No commit; existing visual-publication fixtures remain untouched.

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
