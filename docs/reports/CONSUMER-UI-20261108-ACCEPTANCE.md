# Consumer UI 20261108: accepted application and release preparation

This batch implements seven requirements on the existing public storefront. It has independent local acceptance on dev4; it is not a production release. Production previously accepted 20261107.1/fc57d58 with V27. No production operation is part of this preparation.

## Requirements and design

1. Product detail uses two columns on desktop and one on mobile, natural-ratio official images, legible names/specifications and separate actual-sale/reference-price/conditions sections.
2. Consumer detail no longer exposes image provenance, file names or source links. Original images, provenance, sourceUrl/assetKey, relations, history and authorized internal review remain intact.
3. Recommendation issue directory remains discoverable, with bounded desktop icons/full hover or focus titles, touch and mobile entry, keyboard/Escape/ARIA support. Fetch one bounded metadata page after initial cards; retain lazy history, pagination/cache and request isolation.
4. Remove duplicate home-brand navigation while retaining the required navigation, crawlable initial HTML/SEO and homePath selection.
5. Display current User.name for already-public merchant IDs; retain historical publisher signatures/IDs. Prevent stale name responses and unknown-merchant substitution without widening public or role scope.
6. Show an accessible 44px translucent add button only with confirmed same-merchant bookable trips and valid actual quotes. Invoke existing quantity/trip/cart guards, including quantity 99 and stale-state checks. Remove repeated unavailable card prose; no new checkout/order/payment path.
7. Remove the entire public marked section only when successful unfiltered full-scope markedScopeTotal is zero. Search/filter/page emptiness, loading and errors remain distinct; no full catalog fetch. Keep authorized marker editing and merchant isolation.

Details follow [the original storefront design](../design/STOREFRONT-PINTEREST.md). No commerce/AI feature or production content/name edits are included. Price/currency/expiry/discount facts, deep links, node/query/category, lazy requests, permissions, galleries and history remain under the existing contracts.

## Independent acceptance and historical evidence

Application source digest: `54df7134207712abc391ecfd5f6ecdb8fe3548381035e2b7293332a4b6fbda0d` (33 files).
The portable [accepted inputs](consumer-ui-20261108/accepted-inputs.json) bind original worktree and Git LF hashes, unchanged V1–V27 migrations, accepted local Java class hashes, frontend file hashes and QA receipt/report.

[Independent R4 report](CONSUMER-UI-20261108-R4-QA.md): SHA256 `dacecf6ad09ce6fc736f812598671110218349f92775c34607e10d03fb96556b`.
Original local receipt: `frontend/test-results/consumer-ui-20261108/qa-r4/QA-RECEIPT.json`, SHA256 `47181bdd981376cf68319a3028569c59bf9853416434a02ce14663431d61dc55`.
D1–D13: 12 PASS, zero FAIL, D10 actual speech NOT_RUN accepted by PM as nonblocking. Keyboard, ARIA and native AX passed; speech output was not captured.

R4 independently passed 12 specified browser paths plus one context path and seven hook tests. All original six failures now retain exactly the pre-open scroll/target rectangle, visible correct focus and stable second samples. R2 closed reservation eligibility/contrast; R3 and R4 closed focus/scroll regressions. Earlier FAIL reports and raw ignored evidence remain preserved, not relabelled. Raw local GUI fixtures/screenshots are intentionally not published in Git.

## Delivery changes and remaining gates

The first committed candidate `e276191e4ddeada9039654166353609b5ca56e53` triggered CI `42465225280`: backend/release guards passed; frontend had 365 PASS and one FAIL, so Docker packaging was correctly skipped. `PublicProductMarkerEditing.test.tsx` still asserted the superseded disabled-card add button. The requirement now hides this button for unavailable products. The follow-up changes only that test to assert card-button absence and the permitted disabled explanatory detail action, retaining owner editor access and no onAdd call. No accepted application runtime bytes or local QA source inputs changed. This new regression-test input requires its own successful exact-commit CI; the original failure is preserved, not rerun unchanged or marked PASS. Initial dependency security `42465225286` succeeded; its old SHA is not reused as the new exact-SHA gate.

Application inputs are unchanged after independent R4 acceptance except Git line-ending normalization. The separate CI delivery change keeps all existing checks and adds immutable source-labelled production core/frontend images, artifact extraction and hash manifest upload. Its new helper validates the 33 accepted sources and migration list before packaging. The backend monolith used in local QA is not passed off as the production core wrapper: CI rebuilds core with the current shared implementation and reports byte/class comparison honestly.

New exact-commit CI, CodeQL and dependency security are required. Existing fc57 checks apply only to the older release. Optional manual jobs that are skipped are not PASS. Independently bind the downloaded core/web artifacts, investigate any class/web byte differences, and review the exact production operator inputs before activation. The old resume operator is pinned to fc57/20261107.1 and must not be reused unchanged.

Before a future separately authorized activation: obtain current live version/schema/config/lock/space and rollback-image baseline; verify a fresh private consistent V27 backup without downloading the database; enforce writer/config/concurrency guards; compare full V27 structure and business fingerprints. Replace only core/frontend, preserve protected services and all current data. No migration replay and no old database restoration. Rollback replaces only applications and retains V27 and subsequent writes. Actual public version/pages and protected services require post-switch acceptance.

Local shared-machine heavy operations remain deferred while another project's resource window is occupied. Git/metadata and hosted CI preparation do not start/rebuild/restart any of the existing seven containers.
