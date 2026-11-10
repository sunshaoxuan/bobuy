# Local candidate: product archive and RustFS application acceptance

2026-10-28. Local-only candidate, no push, CI dispatch, production identities, production image transfer or deployment. The independent currency placement correction f747041 was preserved by cherry-pick (15e9a13) into this candidate; original local main was not reset.

## Product archive

The old Stock Master and administrator recycle-bin menu entries managed the same `bb_product` entity. They are now one **商品档案管理 / 商品檔案管理 / 商品マスター管理 / Product records** entry at `/admin/products`. Active and deleted status views share this page; `?view=deleted` persists selection through refresh and browser history. Stock entry/edit/query and the existing reviewed no-image cleanup/restore actions are reused, not reimplemented. After a deletion/restoration the opposite view refreshes its data; visited editors stay mounted across tab changes.

Only platform administrators receive the deleted view. A merchant's forged deleted-status URL never mounts the deleted-data component. Customer/anonymous admin routing and existing server-side lifecycle authorization remain enforced. Platform admins without merchant status retain only their existing deleted-data capability, not a new merchant privilege.

Old `/admin/stock-master` and `/admin/deleted-products` URLs redirect compatibly, retaining query/hash/product selection. Recommendation catalog/gallery links now use the canonical product route. The currency directory stays under Basic data. No product ID, recommendation relationship, regular price, sales adjustment, stock or publication record was rewritten.

Desktop image review exposed narrow name columns; the reused stock table now keeps readable widths with horizontal scrolling inside the table. Mobile uses existing cards, with a wider label column. This is not a general inventory redesign. Existing legacy stock price caption still contains a fixed USD translation beside the preexisting JPY suffix; no pricing/currency behavior was changed in this navigation batch.

## Real application acceptance

The existing shared local fixture has a V7 checksum and V8 history from other work, incompatible with this candidate's migration history. Actual Flyway correctly rejected it. No repair, history rewrite, fixture overwrite or validation bypass was used. Its V20 database/14 images/846106 bytes/34 products/60 recommendations was preserved.

Instead, the existing PG18.6 container hosted one owned disposable synthetic database `bobuy_rustfs_app_test_20261028`. Official Flyway first built a V20 baseline; actual Spring startup then migrated V21, and full Hibernate schema validation succeeded. Existing seed accounts were used only inside this disposable database. Subsequent retries reused that owned fixture rather than rebuilding a parallel stack.

Real Java SDK and actual PG/Spring services passed:

- Concurrent distinct PUBLIC/PRIVATE media IDs bind the same raw SHA/CAS key with two retained references; both actual RustFS transfers verify.
- Repeated scoped backfill is idempotent; PG media/outbox/reference writes roll back together.
- Anonymous/customer/private-ID HTTP checks reject before object access.
- Normal merchant logical deletion and administrator restoration retain the shared object and bytes.
- A genuinely corrupted synthetic S3 payload falls back to retained PG; restoring it recovers object reads.
- Injected adapter outage also falls back; real PUT followed by simulated lost response retries by reading the existing object without a second PUT. The response loss/outage injections are explicitly simulations, not claims of a physical network outage.

The real probe found and fixed a preexisting authorization gap: an image used only by a product master gallery remained directly accessible after that product was deleted, while recommendation-item references already had a guard. The guard now includes deleted master-only gallery references, while active references keep a shared public media ID available. ProductLifecycleIntegrationTest adds delete/restore regression coverage. No real product or production image was used.

## Gates and screenshots

- Actual application probe PASS; original V20-to-V21 startup and later successful restart records are preserved separately from failed attempts.
- Targeted backend: ProductLifecycleIntegrationTest 5 and CurrencyDirectoryIntegrationTest 1, all PASS. Earlier matching offline media/commerce/catalog/SDK evidence is reused; not relabeled live S3 evidence.
- Final affected frontend: ProductArchive 5, DeletedProducts 3, StockMaster 9 PASS; unchanged matching Currencies 3 and ProductPricingPanel 3 PASS retained.
- Final build: 1158 i18n resources/negative fixture, TypeScript and Vite PASS. Existing vendor chunk size warning is not a failure and was not hidden.
- Real installed Chrome/Playwright, one serial scenario PASS (12.2 seconds): normal UI login, one menu entry, desktop delete, reopen/refresh, touch-simulated mobile restore, repeated same-page delete/restore refreshing both views, back navigation, old links, all four title languages, Basic data currencies and customer rejection. No hidden write API was used for UI acceptance.
- First browser attempt could not launch the absent downloaded Chromium; installed Chrome was reused. A subsequent selector failure used `Log in` instead of actual `Sign in`; no login/write occurred. Single-action timeout is now 10 seconds so a bad selector does not consume the whole 90-second scenario budget. These failed attempts are not passes.
- Reviewed final desktop-deleted/mobile-active/mobile-deleted screenshots are retained. A separate full-page desktop-active capture after a scrolled language interaction displaced the sticky header in the screenshot; that capture is excluded from delivered screenshots rather than described as a clean layout capture.

## State restoration

The disposable application database was dropped only after browsers closed and backend/web stopped. The original shared database summary matched its baseline. All six original service image IDs were restored exactly, backend test credential mounts removed, and all six original services plus RustFS stopped. Test secrets/bucket/objects remain only in the approved test assets for later resumption; no object/data volume deletion or global prune occurred.

The installed Compose lacks `create --no-deps`. The initial configuration restoration command failed before recreating containers; recovery used verified `up --no-start --no-deps --no-build --pull never` with recorded original image IDs, not mutable current tags. Final state checks passed. This failure and recovery did not affect production.

## Production boundary and remaining work

RustFS remains test-only. No root/app key or CA/leaf private key was created for production. Production 566-image migration, deployment and cutover were not attempted. GC remains audit-only with no object-delete grant or executor.

Before a production migration candidate is considered ready:

1. Confirm the precise production security proposal: existing host185.184.223.41, private `bobuy-media` bucket, internal `bobuy-net` only/no published port, dedicated root and limited application identities, restricted `/etc/bobuy/secrets/rustfs` files and SDK-only CA trust. Root never mounts into the application; application has no delete/IAM/bucket-administration grant. Approval is still required for these production identities/keys/TLS mounts/service membership.
2. ListBuckets returns200 filtered to the current allowed bucket, not403. Existing tests prove CAS-prefix, object-delete, IAM and application-private-ID denial. Isolation against a second existing bucket is not established. A precise additional test asset, if approved, would be one empty private bucket `bobuy-media-test-denied`, using existing root only for creation and existing app for negative reads, with no extra app permission or identity. It has not been created.
3. Package/review a production-only resumable operator runner and full reconciliation report around the tested internal backfill/worker primitives; there is still no scheduler/startup migration endpoint. Verify exact per-object totals/hashes, incremental writes, TLS renewal and activation/recovery on the final deployment configuration. No production downtime estimate is inferred from small synthetic tests.
4. Request a measured production deployment/cutover window separately. Preserve PG binaries and reference metadata, allow rollback to PG reads, and never clean production objects/PG bytes under this test authorization. Currency/navigation inclusion in a production release also needs to be explicitly identified; local integration is not deployment approval.

Post3 remains untouched; no browser extension fileURL expansion, operational local-file reader, SMTP activation, registration opening, sale activation or real content publication occurred.
