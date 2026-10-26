# Recommendation workflow release — 2026-10-26

Production **20261026.1 is published**. Runtime implementation is
`dc9a27c7f78580cac9eb41779918276df9c8cd1e` on actual `main`.
[BOBBuy CI 40285859378](https://github.com/sunshaoxuan/bobuy/actions/runs/40285859378)
returned that exact SHA and all four required jobs succeeded. The original wrong
CI reference 40285859356 (dependency-check) and its verified correction remain in
the production evidence directory. No prior user worktree was reset or overwritten.

## Formal UI and shortest operator path

- Admin: https://bobuy.cc/admin/recommendations (visible **好物推荐** menu).
- Customer: https://bobuy.cc/recommendations; individual article /recommendations/{id}.
- New recommendation → paste JSON array / optionally select matching images →
  validate and preview → correct rows → register all → review customer preview.
- Registering saves draft facts only. Title/body are saved separately as a draft;
  publication is an explicit separate action and requires title, body and items.
  Published content must be withdrawn before editing. This task imported/published
  no real products and created no production draft.

## Batch contract

See [JSON Schema](../recommendation-batch.schema.json). Maximum 200 rows, so the
122-item issue fits one batch. Each row needs `name` plus either `imageUrl` or
`fileName`. `imageUrl` accepts official HTTPS images under
`cds2.costcojapan.jp/cds/mail-images/`. `fileName` exactly matches a PNG/JPEG selected
with the visible file picker. Nonempty images are limited to 8 MiB and decoded
with dimension checks; remote redirects and other hosts are rejected.

`itemNumber` is a string (retain leading zeros), or omitted/null. Optional facts:
`referencePrice` (offer/sole stated price), `originalPrice`, `discountAmount`,
`priceUnit`, `offerStart`, `offerEnd`, `couponStart`, `couponEnd`, `offerNotes`.
All amounts are JPY (optional `currency` may only be JPY). Numeric amounts are
nonnegative with at most two decimal places. Dates use YYYY-MM-DD, inclusive Japan
dates, per item; either end may be omitted. Offer/redemption dates and coupon-issue
dates are separate. Missing source facts remain unknown, never inferred or zeroed.
Use `priceUnit: "100g"` for per-100g prices and notes for extra conditions.

Previewing writes nothing. Same post + exact string item number + image hash reuses
the existing row; replay updates its reviewed facts. Without a number, only an
identical image deduplicates within that post. Different images and different
issues retain separate rows/facts. Recommendation entry creates no stock product
and never overwrites inventory USD selling prices.

## Acceptance and publication evidence

- Backend reports: 195 tests, no failures/errors, two existing external-AI skips.
  Actual gated class coverage: line 92.35%, branch 74.66%; unchanged 90%/70% limits.
- Frontend: 27 files / 94 tests, i18n/TypeScript/Vite build passed. The shared
  workstation worker count is bounded to reduce contention. Backend CI now runs
  one coverage test stage with a temporary output path and explicitly rejects
  missing data; earlier skipped-data runs were not accepted as coverage evidence.
- Shared local Chrome: normal visible entry, batch validation/preview, local images,
  one official remote image, optional facts, string IDs, JPY independence, exact
  dedup, item edit/correction/reload, withdrawal, desktop/mobile periods, per-item
  exceptions, missing endpoints, expired/upcoming, separate coupon dates passed.
  Japan midnight/inclusive-end behavior is also covered by focused tests.
- Production: normal admin login and visible menu, successful business APIs, empty
  draft list, desktop/390px mobile layouts, secure refresh cookie, public empty feed,
  exact frontend entry/editor/customer-offer byte equality passed. Page errors and
  failed business API responses: zero. Physical devices were not tested.
- Applied migrations: V1–V7 and V9. V8 belongs to independent unpublished AI settings
  and is intentionally absent. Six running image IDs match the release binding;
  five Java services healthy, frontend running, zero restarts/OOM. Existing other
  projects remain unchanged. Verified database restore, schema/history fingerprint
  and object backup remain root-only in /opt/bobuy/releases/20261026.1/backup.
- Production counts: one user, zero trips/orders/products/recommendations/items;
  no published content or temporary restore database. No failed production upgrade
  or rollback occurred. Rollback material is retained; stop writers and restore
  the matching snapshot/application together if rollback is required.
- The independent earlier storefront error could not be reproduced. Before this
  release, old-version product/trip APIs returned HTTP200 successful empty arrays;
  after release, fresh public Chrome and all business APIs passed. Its original
  browser/network cause is not established.

## Exact limitation and excluded work

Automatic approval **denied** the draft-writing production verifier before execution
because saving a review draft was judged potential production-data contamination.
No draft was created/saved and no denied operation was retried. Read-only production
verification passed instead. Draft save/edit persistence is proven with synthetic
data in the existing shared test environment, not by production writes. The parent
can next create the actual issue through the formal UI during authorized ingestion.

AI connection settings, credential encryption, security/Compose changes, optional
AI authoring and inventory mutations were kept in the original worktree and were
not released. The original shared test containers were reused, with no test image
or container created. Only the normal production release images/services changed.

Detailed receipts: [candidate](evidence/recommendation-offers/candidate.json),
[production acceptance](evidence/recommendation-offers-production/acceptance.json),
[CI correction](evidence/recommendation-offers-production/ci-binding-correction.json),
[runtime](evidence/recommendation-offers-production/final-runtime.json),
[public browser](evidence/recommendation-offers-production/browser-readonly.json).
