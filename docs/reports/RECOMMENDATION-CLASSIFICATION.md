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
correction; this final check now passed. Existing successful batch/filter workflows
were reused without another import.

Exact runtime candidate: df892e9a923baeef1bad372e951a2d59328b525a on main.
BOBBuy CI 40295807208 verified that exact head: backend 199 tests, zero failures
or errors (2 skipped); frontend 96 tests in 29 files; release tools and production
Docker builds passed. BobbuyStore coverage: lines 93.69% (minimum 90%), branches
80.26% (minimum 70%). No threshold was reduced or required gate bypassed.
Image archive SHA256:
9772cc8a4003c894f724d77801e12835aaf532ecd3a89dc35199d07a61ce7798.

The synthetic local browser fixture was withdrawn after validation. Its receipt
records category create/rename/search, selecting 25 items across table pages,
multi-category membership, hidden and visible supplier, All/unclassified/empty
filters, repeated clicks/back and mobile behavior. No synthetic production write
was attempted. Only the new read-only production verifier is valid for this release;
the old draft-writing offer verifier was not run.

Normal UI usage: open /admin/recommendations?post=1 and use the classification and
supplier panel. Create concise labels from reviewed actual products; search/select
rows, or select all matching results, choose add/remove/replace labels, and confirm
Apply. Supplier changes have their own update toggle; select/create a supplier and
leave customer visibility off for this Costco issue. /admin/suppliers remains the
full supplier maintenance entry. Master labels and suppliers do not publish an
issue. Applying classification preserves its draft state; publishing is separate.
This engineering release does not assign real classifications/suppliers or publish.

Customer filters appear at /recommendations for published content. All is always
available; Unclassified appears when needed; multiple labels never duplicate an
item. Unused labels are omitted. Filters cover the currently viewed published
issue/feed page, rather than global search across older feed pages. Because post 1
remains a draft, public recommendations correctly remain empty until an authorized
editor publishes through the normal UI.

Production 20261026.2 was activated and accepted. The staged database snapshot
successfully restored into a temporary database before migration; that database
was removed. V10 applied; all six running image IDs match binding.json, app health
passed with zero restarts/OOM, and protected service state remained identical.
The normal production browser opened post 1 with all 122 items and supplier
visibility off, checked desktop/mobile and exact served feature bundle hashes,
and verified public products/trips/recommendations APIs returned 200. No page
errors or failed APIs were observed. Public recommendations remain empty.

Before/after fingerprints match exactly (original columns, no content mutation):
post f5ef084ebd52554374053a544a9ccb96;
items a68b387f2721d98450e0e52535b61193;
image binaries 817d49c3bf61e77436e0090ebc963615.
One post, 122 items, 122 images, unpublished. New category IDs remain empty,
supplier IDs null and display flags false for all real items. No backfill,
re-import, save, assignment or publication was performed in production.

Final machine-readable evidence: evidence/recommendation-classification-production/
binding.json, ci.json, ci-tests.json, content-before.json, content-after.json,
backup-check.json, browser.json and release-result.json. Production backup remains
under /opt/bobuy/releases/20261026.2/backup/; credentials and backup contents are
not committed. The final receipt commit changes documentation/evidence only;
runtime source remains df892e9a923baeef1bad372e951a2d59328b525a.
