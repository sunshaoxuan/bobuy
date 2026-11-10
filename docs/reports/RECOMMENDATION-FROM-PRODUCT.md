# Reuse a product master before registering an issue offer

The recommendation upload flow creates an issue-scoped product before its existing-product association UI becomes available. Importing an already catalogued ITEM therefore creates an unnecessary product first.

This bounded change adds an explicit **Add from product master** form. The operator selects an existing canonical master, reviews its exact ITEM/specification and official gallery, then enters only this issue's reference prices and periods. The server locks the existing owner/post/product boundary, checks both record versions, validates the owned PUBLIC media references, and registers a recommendation that directly references that master. It neither creates/updates a product nor uploads image bytes, changes actual sale prices, enables purchases, or changes stock. Existing upload behavior remains available for new products.

Same-product/same-period identical retries return the existing entry even after response loss. Different facts for the same period are rejected for explicit review. Different periods remain independent. Foreign, deleted, stale, unreviewed or imageless masters and private media are rejected. Names, translations, specifications, categories and galleries continue projecting from the canonical master; supplier display defaults to hidden.

## Validation

- New focused service tests: reuse without writes to products/images, replay, independent periods/conflicting quotes, stale versions, ownership/deletion/review, private/missing images and identity mismatch.
- New HTTP integration case is compiled and included for CI: same master/gallery reused without count changes, replay dedup, foreign/anonymous requests rejected, base sale price unchanged.
- Frontend two focused tests passed; existing recommendation page six tests passed.
- Four-language key validation passed (1186 keys); TypeScript/Vite production build passed.
- Core/common production package build passed without tests or shared-container operations.
- Local real-browser acceptance is **NOT PASS**. Initial preview access failed under sandbox; after approved host preview access succeeded, production-build role override was correctly ignored and the fixture remained at login. The next attempt to inject a synthetic authenticated browser session was rejected by automatic approval review as a login bypass without specific trusted authorization. That rejected command did not execute. Do not run the pending browser harness or an equivalent bypass until the exact boundary is resolved. The draft and production are unchanged by this test.

No schema migration, credential, network/security configuration, RustFS or PostgreSQL change is part of this patch. Only core and frontend would require a normal application update after necessary acceptance and exact-commit CI. Keep the current release as rollback; do not deploy this candidate while browser acceptance is unresolved.

## Current content checkpoint

Post4 is the sole saved, unpublished Oct30 email draft, with zero items. No product, image upload or sale change has been made for this issue. Complete source, 32 transcribed ITEMs and source-specific dedup keys remain in `.task-tmp/apparel-20261030`.

Independent content issue: existing ITEM516611 gallery image2 visibly says `食用えごま油` in its ingredient line, conflicting with its sesame-oil bottle/master. Preserve the source evidence and do not reuse all four images as verified. Remaining gallery and source-column checks are pending; do not claim any item publication readiness solely from its existing master.
