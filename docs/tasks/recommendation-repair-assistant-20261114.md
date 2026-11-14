# Recommendation repair assistant — 2026-11-14

## Authorized scope

Implement server-derived source-context previews and confirmed batch application, editable AI locale suggestions through `LlmGateway.translate`, one-click entry points from publication failures, and the related UI/UX guidance. Source artifacts remain private; unknown business facts remain blank. This change does not alter publication gates, hashes, historical/production data, or deployment state.

## Change and minimum verification map

| Change | Minimum verification |
| --- | --- |
| Source preview/apply service and API | Focused service/controller tests: multi-item preview, cancellation/no write, supplier-only preservation, artifact response redaction, version conflict |
| Locale suggestion/confirm service and API | Focused service tests: label/edit/confirm, failure remains blank, source hash remains current without changing review timestamp |
| Repair modal, failure-panel and batch entry points | Focused Vitest component/API tests, TypeScript check, Playwright 390×844 and 1280×800 screenshots plus computed styles |
| UI/UX rules | Diff/static review |

## §8 / §9 acceptance

The changed UI must reuse existing tokens/components; expose keyboard/focus/hover states and labels; use at least 44px touch targets; keep four-locale text readable without horizontal overflow at the 767px breakpoint and 390px viewport; and keep an actively repaired card full-width where necessary. Browser evidence must cover source derivation (including an unresolved field), supplier-only repair, editable/confirmed AI suggestions, and the publication-panel one-click action at 390×844 and 1280×800. Record computed width, height, min-width, min-height, border radius/color/width, background color, and box shadow for the key controls.
