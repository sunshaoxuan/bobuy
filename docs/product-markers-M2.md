# M2 Information-Only Product Markers

## Scope
Merchant workspace adds /admin/product-markers alongside the existing product archive.
The management page follows the merchant (AGENT) navigation scope. Platform-admin-only
sessions do not gain merchant data access. Backend MerchantScope/ownership checks remain authoritative.
No category-ID normalization is included.

## Definitions
Definitions have a stable immutable code, one Unicode-code-point badge, four required locale
names (ja-JP, zh-CN, zh-TW, en-US), optional localized descriptions, seven preset colors,
sortOrder 0..10000, enabled and an optimistic version. Create excludes version; edits send
the original code and loaded version. Disabling hides public badges without deleting associations.
Management uses explicit save and preserves drafts after errors. Reload discards only after confirmation.

The explicit confirmed initialization action idempotently creates missing defaults:
- new: 新, green, sort 0, New product.
- discount: 折, red, sort 10, Discount.
- low: 少, orange, sort 20, Low quantity.
- missing: 缺, gray, sort 30, Out of stock.
Initialization never assigns products and never runs automatically on page load.

## Product Assignments
Saved product records expose a tag-icon action in table, mobile list and archive card views.
A separate drawer loads definitions and the product's current set/version. It permits zero
through fifty distinct markers, including retention/removal of disabled definitions. Clearing
changes local selection only; Save replaces the set explicitly. Errors preserve the draft.
Switching product identity cancels stale reads. Unsaved dismissal requires confirmation;
saving prevents drawer dismissal. New unsaved product records have no assignment action.

## Public Display
The public catalog presents marked products above all public products. Each section separately
traverses its complete 24-entry server pages, loads assignment batches of at most 100 IDs,
then exposes independent filtering and 24-card load-more. Query uses the complete section.
Filters use separate category and markedCategory URL keys. Same product can appear once
in each section. Duplicate product IDs within a section fail the existing catalog traversal guard.
Marked endpoint membership comes from explicitly assigned enabled markers on backend-eligible masters.
An error in one section leaves the other independently usable. Stale merchant reads are ignored.

Image overlays show up to three sorted single-character badges plus an overflow count to
bound image coverage. The product drawer shows the complete enabled marker set. Disabled
markers never display publicly. Tooltip/accessible names use localized marker names.
The independently delivered M1-r1 dark catalog title rule is retained in this M2 overlay.

## Transaction Boundary
All markers, including low quantity and out of stock, are informational. They do not set
purchase eligibility, block cart actions, alter inventory/price, or affect checkout/orders.
The original same-product/same-merchant sale match and canBuy predicate remain unchanged.

## Verification and Integration
Local focused tests and TypeScript/i18n results are recorded in M2-MANIFEST.json when frozen.
Local tests mock backend calls and do not establish persistence, permissions or visual acceptance.
Main integrates onto the actual shipped M1-r1 baseline, runs required integrated gates and
real create/edit/default/reopen/zero/multi/disabled/ownership/conflict workflows against backend.
Main owns the sole existing stack and browser. Desktop 1440px, mobile 375px and narrow
320px coverage must include console/network, longest names, max sort value/50 markers,
loading/errors/conditional actions, complete screenshots and original-size changed-region crops.
Geometry and visual acceptance remain pending until actual glyph/inner-frame/hit-region evidence.
