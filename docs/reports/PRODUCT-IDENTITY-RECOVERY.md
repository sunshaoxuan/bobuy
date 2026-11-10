# Product identity recovery candidate (local, not deployed)

This follow-up supersedes the local recovery blockers in PRODUCT-IDENTITY-SEPARATION.md.
Production content and schema have not changed.

## Old order compatibility

The snapshot is persisted in nullable bb_order_header.product_identities, keyed by stable
order-line ID. Existing lines JSON retains its legacy shape. A Hibernate-only Jackson
mixin omits the six new snapshot fields there; HTTP responses retain structured fields.
Other JSON types retain default module-enabled behavior. Capture occurs before Hibernate
merge, including quick orders. Post-load/save hydration restores API metadata. Original
sale-unit spec is untouched. SKU/name/names/sale-unit mismatches do not attach a stale
sidecar to a changed line. Replacement order objects retain sidecars and removed-line
history is retained.

Exact c15da922 baseline OrderHeader/OrderLine source shapes were compiled as test fixtures
(only package/class names changed). A separate Hibernate SessionFactory with the old
mapping/default strict JSON mapper validates the expanded H2 schema, reads and updates the
same order. The new reader retains snapshot, quantity, precise quote and timestamp. This
is an actual old persistence mapping exercise, not an entire old production application boot.

## Complete master recovery

Every normal catalog save retains complete previous metadata in append-only
bb_product_catalog_recovery: four-language names/descriptions/specification, brand, ITEM,
model, packaging, categories/supplier, gallery and nullable catalogData. Prices, stock and
issue membership are outside restoration writes. The visible restore operation requires
owner, explicit review, current version and unchanged source-item set. Retained internal
images must still exist. Current state is checkpointed first for redo; catalogData=null
is genuinely restored. Changes predating deployment have no new retrospective checkpoint.
Deleted products remain excluded by the existing owner lookup; deletion is not undone.

The drawer shows record version/source-item IDs. Read-only export includes original fields,
post IDs/versions/status, raw quote/windows and original source facts. The current225
production profiles were read-only audited earlier; this new feature has not freshly
exported their numeric versions or complete reverse links from production.

## Migration and rollback

V25 adds one nullable JSONB order column and one checkpoint table/index. No data rewrite,
merge, delete or down migration. Retain these additions on application rollback: dropping
sidecars/checkpoints would destroy recovery evidence and is not an approved rollback.

An H2 PostgreSQL-mode exercise ran actual V25 SQL, validated the old Flyway view with the
same library/default future-migration policy, and performed SCRIPT/RUNSCRIPT recovery with
sidecar and legacy-null checkpoint data preserved. This is not PostgreSQL18 verification.
Existing CI migration verification still targets PostgreSQL15.

Before production, run V25/rollback/backup proof on isolated PostgreSQL18. Verify the exact
production rollback image and Flyway policy, not arbitrary older binaries. Preserve the
existing API maintenance boundary during rollback. Old binaries cannot create new
snapshots: do not reopen new-order creation on an old release before a compatible writer
is available. No production maintenance/configuration/migration was performed here.

## Actual validation

- Full backend:317 tests run,0 failures/errors,2 conditional skips. Subsequent final
  old-mapping/security/sale-unit boundary checks:10 passed. JaCoCo skipped; no coverage claim.
- Frontend affected checks:27 tests passed across6 files, including explicit restore,
  legacy state callback and confirmation layering. Build:1230 i18n keys, TypeScript and
  Vite passed; existing vendor-size warning remains.
- Full regression found the extra public RecommendationFacts constructor prevented Spring
  multipart binding. One canonical constructor now retains old HTTP field compatibility;
  a binding regression test covers it.
- Actual desktop Edge QA: legacy master0 -> save1 -> close/reopen -> restore2, original
  brand/gallery/source IDs and canonical=false retained.
- Actual375x844 mobile QA: bottom sheet375x675 at y169; no horizontal overflow, four
  languages/tab state checked; canonical master0 -> save1 -> reopen -> restore2. A real
  confirmation-layer defect was fixed to zIndex1200 and retested visibly.
- Normal visible read-only export after restores: QA-001 version2/legacy-null/source1,2;
  QA-002 version2/canonical/source3,4. Each retained quotes300/301, windows2026-11-06 through
  2026-11-08; canonical review timestamp restored exactly.
- QA was localhost-only, random ports, in-memory H2, existing synthetic accounts. No real
  business data or paid AI calls. Viewport reset, QA tab closed, recorded/start-time-verified
  QA Java/Node processes stopped. No Docker or unrelated process touched.

Remaining: isolated PG18 proof, exact runtime/rollback-image review, then code deployment
before complete fresh production version/reference export and reviewed normal-UI repairs.
No ordinary per-post approval is missing; production repair writes remain zero.
