# Recommendation categories and suppliers — 2026-10-26

The actual main worktree is `.task-tmp/recommendation-release`; original unrelated
AI/settings/inventory changes remain untouched in the original checkout.

Production baseline is 20261026.1, with one unpublished post (id 1), 122 items and
122 main images, saved by the parent through the formal UI. The earlier zero-draft
record is obsolete. `evidence/recommendation-classification/production-before.json`
contains original-column post/item/image fingerprints for preservation checking.
No real draft edits, categorization, supplier backfill or publication are part of
this engineering task. Production acceptance must remain read-only.

Existing design: bb_category and Product.categoryId; category APIs are read-only.
bb_supplier and merchant SKU source associations already exist, as does the admin
supplier-maintenance page. Recommendations lacked category/supplier associations
and customer filters. Reuse the existing masters, not another taxonomy/supply chain.

Bounded implementation: additive V10 owner-scopes newly created category labels
(legacy shared templates remain intact), adds recommendation multi-category IDs,
optional supplier link and false-by-default public visibility. Backend validates
ownership, selected post item IDs, versions and publication state atomically.
Public responses redact hidden supplier fields. Protect existing supplier IDs from
being taken over through the existing create endpoint.

Admin: search/review thumbnails, select all matching items or across pages,
add/remove/replace category sets, selectively update supplier and visibility, and
confirm before saving. Category creation/renaming is inline; quick supplier creation
uses the existing supplier API and full maintenance remains in Supplier records.
No preset categories or inferred product classifications are seeded.

Customer: horizontally scrollable accessible category pills, All and Unclassified,
multiple-category membership without duplicate products, URL persistence/back,
repeat-click stability, stale/empty category reset and mobile layout. Labels are
derived only from items in the viewed published issue/feed page; empty labels do
not clutter the public filter. Existing inventory behavior is not restructured.

Validation will reuse earlier offer/ingestion tests and add affected service/UI,
ownership/privacy, migration preservation/restore and local synthetic browser checks.
CI owns the final complete backend/frontend/release gates; do not rerun those locally
once affected checks pass. Production publish must verify recoverable backup and
matching post 1 original content/images before and after deployment.

Affected checks: original recommendation integration 8 passed; new classification
integration 3 passed (ownership, cross-post selection, stale version, duplicate
labels, multi-category add/remove/replace, supplier privacy and collision guard);
media JSON compatibility 1 passed; affected frontend 8 passed; TypeScript/Vite and
translation-key checks passed. The final full suites run once in exact-head CI.

Migration rehearsal found the old rollback could not drop parent keys after new
foreign keys were introduced. The publisher now removes foreign-key dependency
edges only after all writers stop and restores all original constraints from the
already-verified snapshot, then verifies the restored fingerprint before starting
old applications. The real PostgreSQL clone upgrade/restore and release-tool tests
passed. No foreign-key validation or production constraint was weakened.

The shared local database contains media JSON with the earlier uncommitted optional
sha256 field. That caused its inventory listing to fail under the scoped candidate.
A minimal optional-field compatibility read/round-trip preserves that metadata;
no inventory data or pricing is changed. Targeted compatibility tests passed.

Local-only packaging reuses the shared database's already-applied V7/V8 migration
bytes, with no checksum repair/ignore and no new environment. All application class
bytes match the candidate. The production artifact uses the actual main migration
chain V1–V7/V9/V10. A final narrow local render/API check follows this compatibility
correction; earlier successful batch/filter workflows are reused, not re-imported.
