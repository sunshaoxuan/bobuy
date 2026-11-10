# Media save/upload compatibility — isolated candidate

2026-11-01. Branch `media-upload-fix`, based on production commit `d77fe7759a22f64f311ddf575a7a4f647fe184ea`.
The independent, unverified AI candidate `d7c620c6875f5250dac8cd22d1465f9f4fad19f7` and its existing dirty report are preserved in `recommendation-release`. None of that candidate is included here.

## Findings and changes

- Confirmed contract defect: the legacy MediaGallery produces `image`/`video`; the API passed those unchanged; server MediaType accepts `IMAGE`/`VIDEO`. Isolated ObjectMapper regression proves rejection/acceptance. The request boundary now normalizes case and retains source/visibility metadata. Production 58146 failure is consistent with this defect, but its server exception log was not acquired, so no claim of production trace confirmation.
- Drawer save previously launched persistence inside a React state updater, immediately showed success and closed. Persistence now runs once outside that updater; success/close follows its successful result. Rejection keeps entered values and the drawer. The save button reflects pending state; mobile autosave no longer independently claims success.
- The normal product-master file picker accepts JPEG/PNG/WebP/AVIF. Its API path prepares WebP/AVIF using the browser's decoder and lossless PNG encoding, without resizing/cropping or mutating the original file. This is a conversion path, not new native server codec support. JPEG/PNG pass through; the server continues independent ImageIO validation and existing hashing/storage/reference rules.
- Input/output limits remain 8 MiB, 8192 pixels per axis and 24 million decoded pixels. Magic and nonempty declared MIME must agree. Animated WebP/AVIF sequences, unknown formats, unsupported decoders, malformed files and oversize outputs fail before upload. Four-language guidance explains conversion and a real decoding failure.
- Hash identity is the uploaded PNG bytes (and the existing server's separately verified stored-byte digest), not a claim that the source AVIF bytes equal PNG bytes. Same source bytes with a different filename produced identical PNGs in the tested browser. Cross-codec or all-browser bitwise identity is not claimed.

## Validation

- Frontend affected tests: API 5, media API 2, product panel 4, StockMaster 11, image preparation 5: 27 cases, reusing unchanged-file runs and rerunning changed-file cases.
- Backend MediaGalleryCompatibilityTest: 2 passed. Lowercase rejection and uppercase acceptance reproduced without production writes.
- Backend focused MediaObjectOnlyIntegrationTest method `browserConvertedPngIsIndependentlyValidatedAndSharesOnlyItsActualStoredBytes`: 1 passed. Uses the actual synthetic browser-produced PNG, independent server decode/pixel comparison, per-owner reuse, two owners/scopes sharing one physical object with two references, byte-exact readback and retained-root GC protection. H2 and a fake object adapter only; not a new live S3 test.
- The integration fixture's first attempt incorrectly inserted duplicate media identities for one owner and hit the existing unique constraint. Corrected the test to use normal same-owner reuse and distinct-owner metadata; no runtime storage changes.
- Real installed Edge via existing Playwright, no network/authentication/local-file URL: 1440×900 desktop and 390×844 mobile/touch. Actual innerWidth asserted. Synthetic AVIF and WebP decoded dimensions/alpha/pixels retained; renamed bytes identical. Forged MIME, corrupt files and oversize input rejected. This is the real conversion/file-picker harness, not full production ProductCatalogPanel acceptance.
- `npm run build`: TypeScript, 1188-key i18n checks and Vite build pass. Existing vendor chunk-size warning remains. `git diff --check` passes.

Reproduction: `npm test -- --run src/api.test.ts src/mediaUploadApi.test.ts src/components/ProductCatalogPanel.test.tsx src/pages/StockMaster.test.tsx src/imageUpload.test.ts`; `npm run build`; `node scripts/verify-image-upload.mjs` (installed Edge required). Backend: project Maven wrapper, `MediaGalleryCompatibilityTest` and the focused integration method above. Generated browser proof: `frontend/test-results/image-upload-browser.json`; synthetic input fixtures are tracked in `frontend/e2e/fixtures/` and server fixture in `backend/src/test/resources/synthetic-converted.png`.

## Release boundary and remaining blockers

No production deployment, CI submission, real content upload, product creation or recommendation publication executed in this batch. Existing four published groups remain untouched by this worker. No schema, credentials, security configuration or runtime server code changed. Only the frontend runtime needs updating after remaining release gates; rollback can restore the prior frontend artifact, without database rollback. Existing server storage/permission behavior remains authoritative.

Production access is blocked by the previously attempted original SSH connection to `root@185.184.223.41:22` with its existing identity: `ssh: connect to host 185.184.223.41 port 22: Permission denied`. The remote log-read command did not execute. Per explicit parent instruction this connection was not retried, replaced with another identity/channel, or used for deployment. Local `file:` viewing was also previously rejected by browser policy and was not retried or replaced with a local HTTP server. Synthetic Playwright tests do not access those denied files or targets.

Full normal production UI acceptance, remote CI/commit identity, deploy/rollback asset verification and production health checks for this candidate remain unperformed. Official-product image pixel review is separate: this format fix does not verify the downloaded business images. The 26 missing-image groups and 1 no-ITEM group remain unpublished; 58146 was not recreated or saved again.
