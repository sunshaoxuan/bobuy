# Recommendation editor: local candidate

This candidate replaces JSON as the primary editing workflow with image-led product intake and three-step article assistance. It is not deployed. Production remains 20261030.1 / d77fe775; post4 remains a draft with its three existing associations. No real content or production configuration was written during this batch.

## Implemented

- Reuse the existing image add modal for paste/drop/upload, followed by uncertain candidate review. Unknown fields stay editable/blank. Uploaded pictures are clues by default; displaying them requires an explicit choice and public-image warning.
- Exact structured SKU official lookup, HTTPS-only Costco source filtering, source links and user-selected gallery images. The actual 7771788 public page has five original zoom images; the parser collects those explicitly declared assets inside the primary gallery, excluding responsive copies, thumbnails and recommendation carousels. It never derives image URLs or ITEMs from filenames. The same ITEM page includes black and blue views, so users must review specification/colour before selecting images.
- Save a private canonical master first, then link the issue's independent reference offer. Explicit existing-master selection prevents duplicate creation; empty existing masters can gain reviewed images without overwriting identity, specifications, sale price or stock. A clue-only incomplete master stays private and unlinked.
- Owner checks, post/master version checks, idempotent retries, shared binary reuse and private-media no-promotion checks. No automatic sale, publication or fabricated inventory.
- Article flow: clarify intent, confirm editable prompt, generate an editable draft. Applying changes only the unsaved editor text. Closing/editing invalidates pending results.
- Remote HTTP Bridge authentication is rejected before credential transmission. Default unconfigured web search no longer supplies mock results; mocks require the explicit mock-search profile.

## Evidence and limits

- Final combined backend verification before the final source-parser refinement: 17 tests passed, including real H2 HTTP intake, clue privacy, adoption, retries, existing-master enrichment and permissions. Log: workspace `.task-tmp/ai-editor/complete-integration.log`.
- Affected source-parser and opt-in saved-public-page checks: 6 passed. Actual previously fetched HTTPS page 7771788 parses to five originals. No new search call was made. Log/receipt: `.task-tmp/ai-editor/final-gallery-test.log`, `final-gallery-diagnosis.json`.
- Final source-page binding refinement: all six parser unit tests passed; a related product's structured SKU cannot be adopted from a different ITEM page. Log: `.task-tmp/ai-editor/final-source-binding-test.log`.
- Five frontend test files: 21 passed; the intake file then passed all four tests including the additional late-research-cancellation regression (22 distinct frontend tests across these runs). TypeScript/Vite build and all 1224 language keys passed for the final application UI.
- Earlier real desktop/mobile Chrome UI checks passed using synthetic intercepted scan/research/save responses. They establish UI behaviour, not real model or search capability. Screenshots are under `evidence/recommendation-intake` and `evidence/recommendation-writing`.
- The final browser rerun failed before page load: `net::ERR_NETWORK_ACCESS_DENIED` at `http://127.0.0.1:4173/admin/recommendations?post=4`. It did not execute UI saves. This is the current `recommendation-intake/browser.json` result, not a successful final rerun; no alternate route was used. Own preview was stopped and browser closed.
- Real image recognition has **not** passed. The prior existing text endpoint returned the synthetic marker with a temporary current-model override, before the instruction prohibiting credential transmission over remote HTTP. It was not repeated. A certificate-valid anonymous HTTPS probe returned a non-model schema and does not establish the API base.
- Correctly resolved existing search configuration fails AES-GCM authentication with `AEADBadTagException`. This proves envelope/master authentication mismatch or corrupted configuration, not which component is wrong. No secret value was returned and no Brave request was sent. No password guesses or configuration rewrites were attempted.

## Remaining dependencies

1. Verified existing HTTPS model API base, followed by explicitly scoped production configuration approval if persistent configuration is needed; see `AI-EDITOR-PRODUCTION-ACTIVATION.md`. Do not send the existing credential to an unknown endpoint.
2. Correct existing encrypted search configuration/master supplied through the project's secure mechanism, or a specifically approved replacement configuration. Known exact official product pages remain supported without search.
3. Real secure vision/search validation and the remaining final browser scenarios (empty-master UI enrichment and final desktop/mobile rerun) once the local browser network restriction is resolved. Do not treat mocks or source parsing as live AI success.

No migration, production restart, new persistent credential or content publication is included in this local delivery.
