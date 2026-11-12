# ERP price adjustment documents

A saved product's existing selling-price panel maintains its associated adjustment documents. There is no independent administration page in this release. The document model supports shared headers and multiple lines. Documents own adjustment periods, prices, reasons and approval history. Recommendation snapshots preserve source evidence; they cannot activate a price or discount badge.

## Document contract

Each header has a document number, merchant, channel, currency, type, reason, period, version and audit actors/timestamps. Lines hold the existing product identity, adjusted amount, prior regular amount and unit. Batch approval is atomic. Every price change requires a reason; cancellation records a separate reason and retains the original approval and reason.

| Type | Price behavior | Discount badge |
| --- | --- | --- |
| PROMOTION | A finite reduction from the applicable regular price | Only while approved, effective and lower than regular |
| TEMPORARY | A finite price change; regular resumes at the end | Never |
| PERMANENT | Updates the applicable regular price from its start; no end date | Never |

Periods use inclusive starts and exclusive ends. The UI explicitly enters Japan time. Imported source date ranges include the stated end day and convert to the following Japan midnight. Missing dates remain unknown. Only approved documents take effect. Drafts may be corrected; approved amounts and periods are immutable. Scheduled/active finite documents can be cancelled. Active permanent prices are corrected through a later document.

Merchant, product, channel, currency and unit define a price scope. Finite approved intervals cannot overlap within a scope. Permanent documents establish the regular baseline and may coexist with a finite overlay; duplicate permanent starts are rejected. A later regular reduction that makes an existing promotion ineffective suppresses its discount status. Owner locks followed by sorted product locks serialize approvals and the daily marker task. Editing lines also invalidates the document version.

## Operator flow

1. Select type, channel, currency, products, amounts, units and reason. Enter the period and save a draft. Reload to inspect persisted values. The list and confirmation show before/after amounts; the server records the applicable regular amount when approving website selling prices.
2. Review and explicitly approve the exact version. Corrections to an approved document use cancellation where permitted or a new document.
3. Source-derived drafts retain readable, scrollable audit evidence. Incomplete product associations can be repaired only within the owner and matching source SKU; established source associations cannot be silently reassigned. Review-required imports need an actual reviewed reason before approval.

`STOREFRONT` is the actual selling-price scope. Approval requires the existing enabled, reviewed selling quote, matching currency/unit and existing pre-order eligibility. Inventory fulfillment remains in its existing workflow. The regular-price setup/edit confirmation also creates an approved permanent document and requires a reason. Currency enablement, product visibility, regular availability, stock and purchase activation retain their existing controls.

`COSTCO_WAREHOUSE` and `COSTCO_ONLINE` hold supplier reference prices. These never become actual selling prices automatically. Approved manual reference documents also work for products with no recommendation occurrence. Public price projections omit private reasons/source evidence and unapproved imported prices.

## Intake, migration and scheduling

Source intake may supply original amounts and dates to create a draft document. Single-item metadata editing no longer accepts independent price/unit/offer-date changes. Recommendation item price/date columns are removed by V35; runtime readers and the server marker SQL use document projections. Historical publication snapshots remain unchanged audit records.

V35 converts the previous one-product adjustment rows into headers and lines and transfers source prices/date evidence into documents. Only complete, already-published, identity-correct and unambiguous source promotions are transferred as approved. Unknown dates, overlap, incomplete identities or unsupported source facts remain reviewable drafts. Replaying the versioned SQL creates no duplicates. The production-data rehearsal and current release boundaries are in [the task record](reports/DAILY-PRODUCT-OFFER-TAGS-20261112.md) and [the release plan](reports/evidence/daily-product-offer-tags-20261112/erp-price-documents/RELEASE-PLAN.md).

The server's `bobuy-offer-markers.timer` runs daily at 01:00 Asia/Tokyo. Its transaction reads only effective approved promotional documents, preserves other markers, checks owner/SKU and price scope, and retains root-only change receipts. Temporary/permanent changes, increases, future/draft/cancelled/expired documents never independently create a discount badge. Conflicting approved scopes are reported for review.

## Checkout and release safety

The shared resolver supplies regular/effective prices, adjustment identity and the next boundary. Quotes retain their accepted SHA256 price fingerprint. Checkout locks sorted products and prices them at one server timestamp; stale/expired acceptance requires a fresh review. Idempotent retries return the original order. Saved order amounts, currency/unit, document identity and pricing timestamp remain unchanged by later price changes.

V35 removes old mapped columns, requiring compatible Java services to switch together. This business-data conversion uses a verified stopped-writer backup and isolated restore/migration checks. Before reopening, a failed upgrade can restore that verified snapshot and the matching old applications. After actual or uncertain reopening, database restoration is forbidden; use forward recovery. Protected services and object-storage settings remain unchanged.
