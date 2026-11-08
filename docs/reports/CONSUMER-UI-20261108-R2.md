# Consumer UI dev2 — two P2 corrections, independent recheck pending

2026-11-08 UTC. **DEVELOPER_DELTA_PASS / INDEPENDENT_REQA_PENDING / NOT_RELEASED / UNCOMMITTED**. This is the same seven-item consumer UI batch in the sole `media-upload-fix` root. No new application, stack, database or executor. Production was not accessed, changed or deployed; its separately accepted baseline remains20261107.1/fc57. No commit/push was performed.

The original [independent QA FAIL report](CONSUMER-UI-20261108-QA.md) and [receipt](../../frontend/test-results/consumer-ui-20261108/qa/QA-RECEIPT.json) are unchanged. Receipt SHA256 `7262eb5664087fae0f97ae1614d612b1004939feb981dd78bada3380e3d3723e`: **7 PASS / D12 FAIL / D2,D4,D5,D8,D10 NOT_RUN**. These are still the last independent decisions. The two issues are developer-fixed below, not independently closed by this report. Original dev1 reports/manifests, QA screenshots/failures and release/recovery evidence remain immutable. Original [PM minimal checklist](../../../pm-20261106/PLAN.md) remains authoritative.

## Minimal source delta

Exactly **three production files and two tests differ from dev1**; no backend/schema/API/permissions/editor/data changes:

- `Storefront.tsx`: shared `canBookProduct` requires authentication state resolved, bookable-trip metadata resolved, live actual quote, and an **already-loaded bookable trip belonging to that product's merchant**. Root eligibility also preserves current node/active-browse merchant matching; it does not impose recommendationReady on root products. Recommendation entries retain their existing recommendationReady requirement. The quantity callback uses the same bookable/quote guard, preventing a direct/stale invocation from opening an empty picker. Existing active-trip browsing/home selection is unchanged. No new requests or full-catalog preload were added.
- `ReservationAdd.tsx`: the existing live-quote helper now rejects an absent quote, nonfinite or negative actual price as well as invalid/not-started/expired windows. A genuine finite zero actual quote remains valid. The existing button activation/expiry and original cart/configuration callbacks remain; no order/payment path was added.
- `consumer-detail.css`: scope the button rules to `.storefront .product-add.reservation-add`, which wins over the legacy `.storefront .product-add` background regardless of chunk load order. Retain76% dark background and fully opaque white icon. Keyboard focus has a dark3px outline with a white inner separation, preserving visibility on light/dark images. Other product-add styles are unchanged.
- `StorefrontContext.test.tsx` corrects the old test that accepted opening an empty trip picker: it now requires eligibility false and no picker/cart write even on direct callback. It adds pending/foreign-merchant and invalid-price negative cases, retaining the valid root quantity path.
- `ReservationAdd.test.tsx` now supplies an actual quote in its positive fixture and tests missing/nonfinite/negative price rejection. This changes an invalid old fixture assumption; it is not evidence the old behavior passed the new requirement.

Candidate `consumer-ui-20261108-dev2` remains on HEAD `fc57d58e773f730158cc827a1c4d221ebce1a594` with uncommitted changes. [New manifest](../../frontend/test-results/consumer-ui-20261108/r2/SOURCE-MANIFEST.json) SHA256 `37a5ddcd4a19917c47911da2d85ca94bde669599b9855f7d4b0ef32844a42aed`. Ordered31-file source digest `ef738953ce56778a235a1f437d9faf6f8b61d496f4b1499ff10408738ef7e58f`; manifest records every before/after SHA for the five-file dev1 delta and a full [review patch against fc57](../../frontend/test-results/consumer-ui-20261108/r2/CANDIDATE-SOURCE.patch).

## Actual local artifact and preservation

Only the web files in the existing local web container were updated, after delta checks. No backend restart/replacement this fix. Final anonymous localhost/container readback **07:06:52 UTC** in [LOCAL-FINAL-READBACK](../../frontend/test-results/consumer-ui-20261108/r2/LOCAL-FINAL-READBACK.json):

| Input | SHA256 / result |
|---|---|
| Actual local web index | `1989e08d92309fd7b7d9db4fe6ee92f8af4fdf32e3df4941d8d38a32126d54df` |
| Actual local JAR, unchanged | `1ac5d916ca78498e04ffaad0338af38505fde17c455f991cc34aeb8c6cc84a5b` |
| Original r2 production publisher, unchanged/not run | `78f0ac580ed0d2647954b7fc56a262afa6795d0786d86d4559383fc815f39e13` |
| Unrelated dirty scripts/local-test.ps1, unchanged | `4e8a397f1d819ced5eb6e23d601b005c74a0a94a963547e1ccae2c5099ffb4b9` |
| Existing seven local containers | Same IDs/images, all running; no volumes/database recreated |
| Existing protected local sample | Post/item/product values, history, provenance/gallery and original image byte hashes unchanged |
| Actual marked projection |24/28, hasNext; no-match query0 still markedScopeTotal28/same datasetRevision; unknown merchant0 with no unrelated fallback |

Docker image IDs alone still do not identify the overlaid local application; use actual hashes. The existing runtime remains ready at localhost18080 for independent QA. This is not a release package or live-production verification. No real account/login, production content, article/name, order/payment or persisted synthetic marker data was changed. Browser fixtures used archived original ITEM14110 images and synthetic metadata/cart only, without database import.

## Targeted executed results

| Check | Actual result and evidence |
|---|---|
| Frontend affected assertions | **62/62 new executions, five files**: context16 (`r2-context-tests.json`), reservation3/catalog15/markers6 (`r2-actions-tests.json`), history22 (`r2-history-tests.json`). The batch CLI named four files but the report contained only three/24; history was therefore explicitly run alone22/22. Counts come from actual reports, never CLI intent. |
| Same-input frontend reuse |20 assertions from unchanged gallery/lightbox/facts/home/directory source inputs. Current combined developer evidence82 distinct; **not82 newly executed and not independent acceptance**. |
| Type/build/prerender | PASS: `r2-type.json`, `r2-build.json`, `r2-prerender.json`. Actual local output matches build. |
| Backend/i18n/SEO/service reuse | Prior12 backend, i18n/SEO and18 independent repository-mock service checks retained on unchanged relevant inputs/JAR. Not rerun or added to independent full-matrix count. No new lint/coverage claim. |
| Browser two-P2/quantity cases | **22/22 exercised cases** in [GUI-p2-final](../../frontend/test-results/consumer-ui-20261108/r2/GUI-p2-final.json), plus8 repeated style observations.1440/390; all224 actual JS/CSS responses match new build; page errors0, attempted server writes0, browser closed. |
| Browser quote/node races | **3/3 exercised cases** in [GUI-races-final](../../frontend/test-results/consumer-ui-20261108/r2/GUI-races-final.json);30 actual asset responses match; errors0, attempted writes0, browser closed. |
| Source/config/protection | Scoped diff check passed; unchanged config/publisher/protected dirty hashes verified. Unrelated report's historical EOF blank remains untouched. |

The22 cases directly cover active/underway browsing with no bookable trip, only another merchant's bookable trip, bookable pending and failure, no/expired/invalid actual quote, valid root quantity selection/reopen at99 with disabled increment, products/current/selected recommendations with touch/Space/Enter each invoking one original action, and absence of simultaneously visible detail. No full `/api/storefront/products` preload appears. The3 race cases cover delayed quote0→valid, same-SPA nodeA→unbookableB with late A quote ignored, and focused expiry returning focus to the current product photo without an add. Root product fixtures need no recommendationReady to qualify with their original valid quote/trip conditions.

Final computed style at both widths is white foreground/SVG on `rgba(32,37,32,0.76)`,44×44. Calculated icon contrast is **7.09:1 over white** and17.21:1 over black, the endpoint backgrounds bounding arbitrary image pixels. Hover keeps the dark background; focus outline is3px with white separation. Developer inspected actual [mobile plus/focus screenshot](../../frontend/test-results/consumer-ui-20261108/r2/p2-final-fixed-plus-products-390.png), [desktop root focus](../../frontend/test-results/consumer-ui-20261108/r2/p2-final-fixed-plus-root-focus-1440.png) and no-bookable screenshots. These numerical checks concern icon/background; actual screen-reader announcement remains unexecuted, as below.

## Reuse and remaining independent work

| Scope | Reuse / recheck |
|---|---|
| D12 two P2 | Independent recheck required on dev2. Developer25 browser case sequences and62 assertions are supporting evidence only. Check remaining card-entry equivalence/eligibility races using the existing synthetic boundary. No new real trade. |
| D1/D3/D7/D9/D11 | Original independent PASS within its limits; relevant detail/gallery/home-SEO/provenance/directory logic unchanged. New button position/cascade and no-full-preload behavior also exercised locally. Bind new output and reuse exact unchanged source evidence; avoid whole-suite repetition. |
| D6/D13 | Keep original independent PASS **within its browser-mock/repository-mock/anonymous-read boundary**. Permissions/editor/schema unchanged. No new real-login/PostgreSQL-write gate is introduced; do not clear28 existing marked products to create zero. |
| D2/D4/D5/D8/D10 | Original necessary missing subcases remain NOT_RUN. This fix did not execute their complete matrices or independently accept them. Prepared plain-data builders and exact replay steps below; lack of execution is not an authorization denial. |

[QA-REPLAY-GUIDE](../../frontend/test-results/consumer-ui-20261108/r2/QA-REPLAY-GUIDE.md) maps every PM missing subcase to existing helpers and new no-I/O `qa-fixtures.mjs`: actual image404 plus both home entries,48-product two-page/late-response/409 inputs, Japan date and distinct same-amount channel/unit/coupon facts, blank/missing/same-name/recommendation-only/trip-only names, empty/503-retry/four-language<=200char directory titles. Builder syntax/construction was checked; that is **not UI/service acceptance**. Actual assistive screen-reader use was **not run or capability-assessed** here; semantic/keyboard checks cannot substitute for it. No formal refusal or known tool outage is asserted for the five items. Independent QA/coordinator resolves the actual single-item capability outcome if needed.

Original dev1/QA FAIL evidence stays unchanged. R2 script failures also stay: initial GUI final write conflicted with its per-case checkpoint (`GUI-p2.json`, retained intermediate RUNNING); no app failure was inferred. First race script used a wrong Drawer class and an unused active-trip URL; screenshots proved the quantity sheet actually open and the B fixture had selected recommendation mode. Correct actual `:visible` selectors and `trips?includeCurrent=true` fixture were rerun in final receipts above; application source/artifacts did not change during those corrections. One inline PowerShell/Node quoting error prevented creating the readback script before any readback action; file-based generation then succeeded. None is relabelled as an approval/environment blocker.

The root is returned after final handoff receipt, with all owned commands terminal and anonymous browsers closed. No Java helper was started in this fix. Original seven containers remain running. Next action belongs to the original independent QA after coordinator handoff; no next batch, commit/push, CI, packaging or production action is in flight. Independent missing cases, exact committed-candidate CI/CodeQL/dependency and eventual applicable release review remain pending.
