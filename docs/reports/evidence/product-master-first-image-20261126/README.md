# Product-master first-image guidance 2026-11-26

## Authorized scope and acceptance

Baseline: `1c94494b8d791707915f7222c07fce0b35e8dcf3`. This candidate changes only the product-master image/source guidance, its four localized resources, and focused assertions. It does not import URLs, automatically upload/save, or change endpoints, authorization, pricing, stock, categories, visibility, or production data.

Minimum acceptance covers these independent stages with synthetic isolated data: source URL alone; local multi-file chooser and staged filename; invalid/missing source; unchecked verification; upload in progress; explicit failure; uploaded draft pending reviewed master save; persisted image after save/reopen. Existing focused tests retain source-only save and multi-file/failure behavior. Image transport tests retain JPEG-byte/`.webp` filename normalization.

Function and appearance are accepted together under `docs/ui-ux-guidelines.md`: reuse existing controls/tokens; keep controls keyboard-accessible and mobile touch targets at least 44px; localize all visible copy in Simplified Chinese, Traditional Chinese, English, and Japanese; allow wrapping at the 767px breakpoint; capture 390px and 1280px states where a browser is available; and run only the directly affected checks.

## Result

The source field now explicitly says that it records provenance and does not import an image. A live next-step message asks the operator to use **Add images**, correct the HTTPS source, check verification, choose **Upload selected images**, and finally review and **Confirm and save masters**, according to the current stage. Existing failure and uploaded-but-unsaved messages remain authoritative.

No frontend API code or backend route changed. Focused component assertions confirm that entering only a source does not show or call upload, choosing a file exposes the disabled upload action, verification enables it, in-progress guidance is visible, and completion remains an unsaved draft without calling save.

## Verification record

- PASS: `cd frontend && npm test -- --run src/components/ProductCatalogPanel.uploadFeedback.test.tsx` — 15/15.
- PASS: `cd frontend && npm test -- --run src/imageUpload.test.ts src/mediaUploadApi.test.ts src/imageUploadFeedback.test.ts` — 17/17, including normalized JPEG transport metadata and signature-recognized JPEG bytes supplied with a `.webp` filename.
- PASS: `cd frontend && npm run typecheck`.
- PASS: `cd frontend && npm run check:i18n` — 2035 resource keys/references plus negative fixture.
- PASS: `git diff --check`.
- ENVIRONMENT LIMITATION: `cd frontend && npx playwright install chromium` was blocked by repeated CDN HTTP 403 responses. The installed Playwright package has no browser executable, so the existing isolated `scripts/verify-gallery-picker.mjs` flow could not capture fresh 390×844/1280×800 screenshots, computed styles, console output, or its mocked endpoint trace in this container. No production access or original user material was attempted. Existing pre-change target-page captures remain under `docs/reports/evidence/product-gallery-upload-20261121/`; they are not represented as candidate visual evidence.

## Unknowns

Fresh browser-level visual and save/reopen evidence remains unknown until a compatible Playwright browser is present. The candidate is locally unit/type/i18n verified but is not merged or deployed.
