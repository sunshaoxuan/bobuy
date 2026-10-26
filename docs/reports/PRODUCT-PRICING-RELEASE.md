# Scheduled price adjustments — production 20261026.8

Production is activated and verified. Application source: `a3cb1154ff63874ef0b45bd2ee042e138cf8e604`. Exact-candidate [CI 40400709577](https://github.com/sunshaoxuan/bobuy/actions/runs/40400709577) succeeded. The subsequent documentation receipt commit does not change running application bytes.

## Normal UI workflow

Open https://bobuy.cc/admin/stock-master and choose **售价与调价** on a saved product. The panel separates the regular selling quote from adjustment history. Confirm a real regular quote separately when appropriate; create an adjustment draft with amount, JST start/end and an optional internal source note, review it, then explicitly approve. Cancellation retains its history. Saving a draft does not change the effective price.

Intervals are start-inclusive and end-exclusive in JST. Before the start and at/after the end, the existing regular quote applies, subject to its original availability rules. Same-product/channel/currency approved overlaps are rejected with conflict IDs; adjacent intervals are allowed. Approved terms cannot be silently edited. Current channel is STOREFRONT; JPY is enabled for actual sales. Other currency registry entries do not enable sales or convert amounts automatically.

Recommendations, storefront and checkout share the server price resolver. A changed or expired cart quote requires explicit review and refresh. Checkout locks products before choosing its common pricing timestamp, validates the accepted quote fingerprint and stores an exact price snapshot in new order lines. Later price changes do not rewrite completed orders. Costco reference offers remain separate and never automatically create an effective sales adjustment.

## Verification

- Exact-candidate CI: backend 215 tests, 0 failures/errors, 2 existing skips; frontend 120 tests in 38 files; release tools and image build successful. BobbuyStore coverage: lines 589/627 (93.94%), branches 194/253 (76.68%); existing 90/70 gates retained.
- Local targeted checks: pricing/checkout 16 tests, pricing/cart 6, selling-price display 2, publisher guards 9 passed. Integration coverage includes JST boundaries, expiry restoration, adjacent/concurrent overlaps, ownership, stale versions, currency precision, unavailable products, changed-cart rejection and immutable order snapshots.
- Existing shared local fixture, normal visible browser UI: save/reopen, approval, overlap rejection, edit, cancellation, natural expiry to unchanged regular price, desktop and mobile passed. No production administrator credentials were used. Evidence: [local UI](evidence/product-pricing/local-ui.json).
- Production read-only browser: actual desktop/mobile/detail, published data and purchase-state preservation, normal administrator login entry, deployed asset identities and unauthenticated pricing endpoint protection passed. No business writes, orders or payments; Cloudflare telemetry is separately recorded. Evidence: [browser receipt](evidence/product-pricing-production/browser.json).
- CodeQL 40400709720 and automatic dependency scan 40400709419 completed successfully. Scan execution success is not a declaration that existing dependency-risk debt is resolved; dependencies were not upgraded in this batch.

## Migration, data and deployment

V17 adds the independent adjustment table and indexes without updating old rows. The shared local restore probe preserved all 27 preexisting tables and verified the publisher's added-table cleanup plus backup restore. Production backup restoration was also verified before activation.

The fresh production baseline includes the parent's completed normal-UI master reviews. All preexisting columns of eight frozen business tables, including order headers, are unchanged. Both published posts remain 122 + 30 items, 142 products and 142 canonical profiles, with 566 image blobs. Supplier display remains hidden. Confirmed real selling quotes remain 0, production adjustment rows remain 0. No inventory, actual selling price, purchasing activation, registration gate or mail configuration was changed.

All five application services are healthy, frontend is running, restarts are 0 and no OOM was reported. Server release-result binds the running application source to CI 40400709577 and release 20261026.8. Backup is retained at `/opt/bobuy/releases/20261026.8/backup`. Release archive SHA256: `1751d99084deb4e8b0620c000ffaa59d71e0825da064ffbc2f16ed633b7ce3b6`.

Receipts: [release result](evidence/product-pricing-production/release-result.json), [binding](evidence/product-pricing-production/binding.json), [after audit](evidence/product-pricing-production/audit-after.json), [backup check](evidence/product-pricing-production/backup-check.json), [desktop](evidence/product-pricing-production/customer-desktop.png), [mobile](evidence/product-pricing-production/customer-mobile.png), [mobile detail](evidence/product-pricing-production/customer-detail-mobile.png).

No blocker remains for this batch. SMTP authentication remains paused awaiting the previously requested safe login; it is independent of price adjustments. Real selling terms and any effective adjustments still require normal reviewed UI operations by an authorized operator.
