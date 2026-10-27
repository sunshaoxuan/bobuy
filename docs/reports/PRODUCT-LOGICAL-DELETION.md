# Product logical deletion candidate — 2026-10-27

Status: local acceptance complete; this report does not authorize production activation. Production remains 20261027.1 / PostgreSQL 15.19 / V17. The fifteen real no-product-image records have not been changed.

## Behavior and formal UI

Platform administrators enter `/admin/deleted-products`. “Review products without images” lists active candidates; search and select the audited product IDs, review linked recommendation IDs, check the explicit review confirmation, then logically delete. The server independently checks platform-admin identity, versions, unique IDs and empty galleries. “Deleted products” lists retained records and restores their original recommendation associations. Mobile uses cards with directly visible restore buttons.

V20 adds nullable deletion markers, a partial index and an append-only lifecycle-event table. It removes no product, image, SKU, recommendation or historical business record. Ordinary owner deletion also becomes logical deletion. ORM queries exclude deleted products; recommendation projection and covers exclude their linked occurrences. Topics remain, and existing client filtering recalculates visible counts. Restoring restores the same IDs and source-period evidence. Existing sales remain disabled/unpriced; no reference price is promoted to a selling price.

The recycle-bin API has both existing platform-admin route authorization and a fresh server-side platform-admin check. Non-admins cannot list or restore deleted records. Versioned locked deletion and conditional restore reject stale/concurrent actions atomically. Exclusive deleted-recommendation source images are denied by the public image route; shared active images remain usable and stored bytes are retained.

## Acceptance evidence

Evidence is in `evidence/product-lifecycle/`:

- Backend: ProductLifecycleIntegrationTest 4, ProductCatalogIntegrationTest 4 and ProductPricingIntegrationTest 4 passed. Coverage includes anonymous/customer/merchant denial, direct/list/search/recommendation visibility, fifteen deletions leaving 137 recommendation occurrences, restoration, retained history, stale/duplicate/nonempty-image rejection and concurrent single-transition audits.
- Frontend: DeletedProducts 3 and ProductCatalogPanel 2 passed; frontend build and four-language key checks passed. Existing vendor chunk warning is unchanged.
- `migration-restore.json`: native PostgreSQL 18.6, all 30 preexisting tables fingerprinted including image bytes, additive V20 preserved their data, actual baseline archive restoration matched, disposable database removed. This is not a claim of native V20 execution on production PG15.
- `local-ui.json`: visible desktop delete, reopen, original item restoration, count/topic/direct-item behavior and fixture cleanup passed. No API setup writes replaced UI actions.
- `mobile-ui.json`: four checks passed including visible restore without horizontal scrolling, preserved private association, cleanup and anonymous denial; the overall report remains FAIL because its final customer navigation wait raced login completion. `customer-ui.json` independently completed that exact customer visible-login/direct-route check, login HTTP 200 and PASS. The harness wait now follows the verified login-form-disappearance sequence; the historical failure is intentionally retained, not rewritten as PASS.
- Screenshots inspected: desktop-reviewed, desktop-deleted-reopened, mobile-deleted, mobile-reviewed, mobile-restored-recommendation and customer-access.

Only local fixture post13/item61, product `bobuy-rec-v1-6cfc3be4-77e5-39f5-aad9-2bd8c55c7fe9`, ITEM `LIFECYCLE-UI-20261027` was exercised. Final state: article withdrawn, product logically deleted, public count back to baseline four. No repeated fixture creation or production content writes.

The shared local backend retains its existing V7/V8 migration bytes to match its previously applied migrations; application class bytes match the candidate package. No Flyway repair/checksum bypass was used. This local packaging detail must not be copied into production images.

## CI and activation boundary

The main-push workflow runs release guards, backend coverage, frontend tests/build and Docker builds in GitHub runners. It contains no production deployment or SSH activation job. Push does not create production secrets or enable mail. Exact commit/run linkage and terminal results must be recorded separately; local acceptance is not CI success.

This candidate includes the prior 295c058 PostgreSQL image-storage changes and inactive mail schema plus V20. Old 295c058 staged images are not this candidate. Before activation, rebuild/bind the existing six formal application images to the new exact commit and completed CI. Retain the current PG15 image/data mount and keep MinIO running; PG18 binary upgrade, mail keys/SMTP, registration and sales activation are outside this window.

Proposed application-only maintenance: 2–3 minutes, reserve 5 minutes, subject to fresh preflight and explicit approval. Basis: local backend restart/health took 20.17 seconds and prior production dump took about 17 seconds; actual restore and health checks need margin. Freeze all application writers, take and verify a fresh stopped-writer backup/fingerprint, apply compatible additive migrations and switch only application services. Check public images plus protected-image authorization, API health, administrator recycle-bin visibility and unchanged real product/recommendation counts/content before opening writes. Do not perform the real fifteen-item cleanup as part of deployment.

Failure before writes reopen: keep maintenance, stop all application writers, restore the exact prior application/configuration and verified stopped-writer database snapshot, compare fingerprint/schema/migration history and health, then reopen only after recovery passes. The existing publisher's restore helper removes foreign-key edges and tables absent from the verified snapshot before `pg_restore --clean`, addressing new V20 audit-table references. Validate the final candidate release binding and rollback command against the actual production plan before execution; do not assume an old application safely accepts V20.

After any post-activation business or logical-deletion writes, do not blindly restore an old database or run old code that ignores deletion markers. Keep maintenance and use a compatible fix or a specifically reviewed recovery that preserves those writes. Retain fresh backup, old PG15 data and required rollback images; no old-data or MinIO deletion is authorized here. Production staging and the obsolete 295c058 maintenance request must be updated only under the new approved plan.
