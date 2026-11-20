# Public Product Catalog M1

## Requirement

The /products route displays every eligible public master in the selected merchant
scope, independently of trips, current sale quotes and recommendation issues. The
API owner enforces strict PUBLIC and nondeleted eligibility. An invalid node scope
remains empty and never expands to all merchants.

## Current wide-screen contract (2026-11-16 production accepted)

The current directory uses server-side `/api/storefront/product-browse` filtering,
sorting and revision-bound 24-item pages. At an initial viewport width of at least
1920px, the mounted directory combines two consecutive server pages into one
48-item display batch. Ordinary desktop and mobile retain 24. Each pair preserves
server ordering, filtering and revision; a partial/failed pair is not committed.
The existing paging hook rejects repeated identities, changed totals and incomplete
terminal pages. Resizing keeps the mounted batch size stable to preserve offsets.
For 352 matches, wide-screen display advances in eight batches rather than fifteen;
the API still needs fifteen 24-item requests. Quotes retain their 24-ID bound.

Only the main container containing this directory expands beyond the previous
1600px cap at >=1920px. It retains 32px side padding, 200px minimum card width,
16px column gaps and the existing card actions. Other routes and <=1919px layouts
retain their current width rules. See [task and acceptance](tasks/catalog-wide-layout-20261116.md).

## Historical M1 Frontend Contract

GET /api/storefront/product-catalog?page=0&merchantId=... uses success/data, 24 rows
per page and items/page/size/total/hasNext. The frontend traverses until hasNext=false,
validates count and page consistency, and publishes complete data atomically.
Search and categories operate on the entire loaded scope. Initial rendering shows
24 cards; manual load-more reaches every matching row. Loading displays progress.
Failures expose retry; merchant changes suppress stale completions.

Master cards preserve brand, name, specification, model, packaging and ITEM identity.
No synthetic issue title or introductory text is attached. Missing translations
show an explicit source-language label. Gallery/detail uses existing components.
Reference offers remain individually linked to their source issue with channel and
period details; they never supply a sale price. Sale display and cart actions only
use same-ID/same-merchant StoreProduct data and existing buyability callback.
Existing home and recommendation routes remain unchanged.

## Deferred Scope

M2 is administrator-controlled information-only markers and marker archives. It
introduces no purchase/stock/order restrictions. API shape and admin routes are
pending main freeze. Accounts remain after M2.

## Verification and Release

Focused traversal, API and component tests plus TypeScript and locale checks belong
to the isolated candidate. Runtime desktop/mobile, real glyph geometry, console,
network, screenshots, independent visual review, CI and production remain pending
main integration and QA. No frontend-only unit result authorizes release.
