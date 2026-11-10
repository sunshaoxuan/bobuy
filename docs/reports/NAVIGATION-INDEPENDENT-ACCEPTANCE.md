# Independent product/currency administration candidate

Base: last verified production commit `d29e07cf327c37c59661cb96b080d521e30228f5`, production release20261027.3. This is an application candidate, not a production activation. RustFS work is safely retained separately at `8f53c22909a45b22d5fc6f13bcceb4a4093ccfe4` on `bobuy/rustfs-preparation`. The same worktree was switched to `bobuy/navigation-only`; no parallel engineering checkout/test stack was created and the original root worktree was not altered.

## Scope and dependency review

Currency sources are f747041; product-archive sources are6bc1dab. One `/admin/products` workspace has active/deleted status views. Old stock-master/deleted-products links retain query/hash. Deleted view and recovery stay platform-admin-only; other merchants cannot mount deleted rows. Currency is shared Basic data at `/admin/basic-data/currencies`, with legacy redirects and a reference link from recommendations. All four locales are preserved. Existing currency IDs/records, product identity, logical deletion, references, source offers, sale status, prices, stock and public content are unchanged.

Includes the small independent permission fix for a deleted product's master-only image reference. It uses the existing V20 product/gallery model, not a RustFS service. Its synthetic lifecycle test deliberately uses the existing image repository rather than V21 classes. No schema migration, storage adapter, credential, security configuration or RustFS deployment is included. PG15 and all current PG image bytes remain the storage path. No real content was written during validation.

## Validation

- Backend clean build, CurrencyDirectoryIntegrationTest1 + ProductLifecycleIntegrationTest5 passed, including deleted master-only image denial/restoration and existing roles/conflicts. Backend package and all six formal application modules built. Backend jar contains CurrencyController and V20, and contains no RustFsObjectStore/MediaBinaryService/MediaIncrementWorker/V21/V22.
- Frontend17 distinct affected cases passed (ProductArchive5, Currencies3, ProductPricingPanel3, Recommendations6). One old currency test read rows before async completion; it now waits for JPY via findByText. Only that failure reran and passed; the16 previous passes remain valid. Runtime code was not changed by this correction.
- Four-language validation1158keys, TypeScript and Vite build passed. Existing large vendor chunk and React Router future-flag warnings were not changed or hidden.
- All82 frontend runtime files match the previously validated6bc1dab tree after text-line-ending normalization. Reuse its actual desktop/mobile active/deleted screenshots, old/deep-link, refresh/back/forward, four-language, synthetic restore and non-admin UI evidence. This is reused evidence, not a new browser run. Source commit and hashes are in `evidence/navigation-only/candidate-proof.json`. No service was restarted for these checks.

## CI/push/deployment boundary

Repository `sunshaoxuan/bobuy`. Existing workflows were inspected: feature push to `bobuy/navigation-only` does not trigger main/copilot push jobs; manual ci.yml on that ref runs tests/builds only, and its Docker images stay on the hosted runner. No workflow invokes SSH, the production publisher or runtime activation. Optional UI/migration/dependency-audit dispatch inputs remain false because this candidate has no migration/dependency change and matching browser evidence exists. A push to main would trigger CI/CodeQL/dependency checks, but **does not deploy production**. Do not move main or activate until instructed; no deployment approval is inferred from test execution.

Formal Compose uses a shared release tag for six applications, so plan a consistent six-image application release, not a claim that changing one frontend file updates production. There is no PG upgrade/schema maintenance or RustFS action. Image preparation occurs before any maintenance. Application replacement can briefly interrupt requests; target2–3minutes with5minutes reserved is a planning estimate from the existing six-application path, not a measured downtime result for this candidate. Obtain the specific activation/window decision first.

The current generic publisher also performs a frozen DB backup/restore rehearsal and has a DB-restore rollback path. Do not blindly reuse storage-migration maintenance or perform unnecessary DB restoration for this no-schema candidate. The application-only execution plan must verify unchanged V20 Flyway history, keep PG running/data untouched, retain current env/Compose/images, swap the bound app images, verify health/permissions/routes and reopen traffic. On failure, restore only old application/config versions and recheck; do not overwrite DB content or the15 logical deletions. If preflight finds schema drift, stop this application-only plan. Deployment scripting/image binding and final activation are not executed in this batch.

## SSH read-only diagnosis

The failed read used `root@185.184.223.41`, port22, BatchMode,5-second connect timeout, no explicit identity. Result: `Permission denied (publickey)`; no remote command ran. Local `ssh -G` (configuration expansion only, no connection) confirms the target/user and default identity paths. Current user's `.ssh` contains only known_hosts/known_hosts.old, no default identity private key; ssh-add reports no agent endpoint. No private key/password content was read and no other identity/key/channel was tried. This explains the unusable current CLI authentication context; it is not evidence of a Bobuy outage.

Minimum restoration: make the previously authorized Bobuy SSH identity available through the existing supported secure handoff/agent in OHR, then explicitly authorize that original connection check. Do not send a private key/password in chat, create a new account or reset server authentication. Current production20261027.3 is last verified evidence, not a new runtime assertion.

Recommendation newest-first/expired-history presentation is a separate next candidate. It is not a prerequisite for this navigation commit and is not included here.
