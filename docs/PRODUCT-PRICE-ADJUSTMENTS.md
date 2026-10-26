# Independent selling-price adjustments

Normal UI: `/admin/stock-master` → a saved product's **Selling prices and adjustments** button. This uses the existing product and confirmed ProductSale as its regular quote. Warehouse/online/email reference offers remain unchanged recommendation facts and are never automatically applied as selling prices.

## Operator flow

1. If necessary, expand Regular selling price and explicitly confirm the actual currency, positive amount, unit and pre-order terms. This does not publish a private product or add stock. Existing stock-product fulfillment remains in the inventory workflow. Optional regular availability dates include the stated Japan day; they are separate from adjustment instants.
2. Enter an adjusted amount, currency, start/end **JST** timestamps and internal source/review notes; save a draft. Drafts do not affect quotes. Reload/reopen to review the persisted values.
3. Approve the exact draft through the confirmation dialog. Start is inclusive and end exclusive; for an entire day, end at the following midnight. The ordinary confirmed quote resumes outside the interval, subject to its existing availability and product visibility. A scheduled or active record can be cancelled; expired/approved terms cannot be rewritten. Drafts can be corrected. All records retain actor/timestamp history.

Current actual sales channel is `STOREFRONT`. Currency is stored independently of interface language and must match the enabled confirmed regular quote on approval. JPY is currently enabled; other registry currencies are not silently enabled or converted. The product is the existing SKU/specification identity; source-channel email quotations are not merged by this feature. Blank/unconfirmed regular prices cannot activate adjustments. No zero-price sale, fake stock or automatic purchase activation is introduced.

Same-product/channel/currency approved intervals may be adjacent but not overlap. The service locks the existing product before validating/approving, serializing concurrent approvals. Conflicts identify the existing record IDs. Regular currency/unit cannot change while an unexpired approved adjustment depends on it. Approval/cancellation does not change the regular amount. Product deletion is rejected when retained pricing history exists.

## Effective quote and checkout

ProductSaleService is the single effective-price resolver used by the storefront product catalog, recommendation purchase links and checkout. Active adjustments override only the selling amount; original source prices/conditions remain separate. Public quotes carry their regular amount, adjustment identity, next price boundary and a full SHA256 price fingerprint. The client refreshes quotes at a known boundary, keeps an existing cart price unchanged until explicit review, and sends its accepted fingerprint with currency/revision at checkout. Old carts lacking a fingerprint require refresh.

Checkout locks all sorted products before selecting one server pricing timestamp, then rejects stale/expired price acceptance instead of silently changing the amount. Idempotent retries return the original order. New order-line snapshots retain exact BigDecimal amount, regular amount, currency/unit, adjustment ID/channel and pricing timestamp; later cancellation, expiry or regular changes never rewrite an existing paid order. Existing order JSON remains readable; no old order is backfilled.

V17 creates one new table and index with amount/interval constraints; it contains no price/content writes. The ordinary publisher verifies a recoverable backup before activation and now freezes existing order rows as well as recommendation/product data. Adjustment history is frozen on subsequent releases once the new table exists. Rollback uses the existing stopped-writer, added-table cleanup and full-backup restore path. No new extension, credential, role or network permission is needed.
