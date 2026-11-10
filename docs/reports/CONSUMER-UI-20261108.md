# Consumer UI 20261108 — developer handoff

2026-11-08 UTC. Status: **DEVELOPER_SELF_TESTED / INDEPENDENT_QA_NOT_RUN / NOT_RELEASED**. This is the seven-item UI batch in the original [PM requirements and D1–D13](../../../pm-20261106/PLAN.md), implemented serially in the sole `media-upload-fix` checkout. The parent assigns independent QA after this handoff; this receipt does not accept or authorize a release.

Production remains the separately accepted `20261107.1 / fc57d58e773f730158cc827a1c4d221ebce1a594`, based on the prior [production outcome](../../frontend/test-results/recommendation-source-p1-20261107/PRODUCTION-RESUME-20261108-OUTCOME.json). This UI task made **zero production calls/deployments**. No new app copy, test stack, database, credentials, dependency installation, orders, payments, account rename or article rewrite was made.

## Candidate and review inputs

`consumer-ui-20261108-dev1` is an **uncommitted** working-tree candidate on HEAD `fc57d58e773f730158cc827a1c4d221ebce1a594`. It is not a new Git/release version. The [source manifest](../../frontend/test-results/consumer-ui-20261108/SOURCE-MANIFEST.json) binds 31 changed/new application and test files, unchanged dependency/configuration inputs, complete local web output, test receipts and the JAR. Manifest SHA256: `23b19b13ecfbc25aaec647f7461b454d3d5c28b2b5f3b62111ec3ef3f4dc7974`. Ordered source-file digest: `fd16c0ce0548b5f7fca3f6482820d1facaa7e3125e92bd2bf5489d3b463793b8`. Review [the source patch](../../frontend/test-results/consumer-ui-20261108/CANDIDATE-SOURCE.patch), including new files; it excludes unrelated dirty files and documentation history.

Final same-stack local readback at **06:26:41 UTC**:

| Artifact | SHA256 |
|---|---|
| Existing local backend `/app/app.jar` | `1ac5d916ca78498e04ffaad0338af38505fde17c455f991cc34aeb8c6cc84a5b` |
| Existing local web `index.html` | `7b4bea9086e55ead93a7da79553e50dfd2245f1d61f22d0d963a75655141c4b3` |
| Existing r2 production publisher, unchanged and not run | `78f0ac580ed0d2647954b7fc56a262afa6795d0786d86d4559383fc815f39e13` |
| Protected unrelated `scripts/local-test.ps1`, unchanged | `4e8a397f1d819ced5eb6e23d601b005c74a0a94a963547e1ccae2c5099ffb4b9` |

All seven existing `bobuy-local` container IDs/images were preserved. The existing stopped stack was started; only its backend JAR and web files were replaced for local acceptance. Backend was restarted once for the new read projection. Web-only corrections did not restart it. The original Docker image IDs therefore do **not** identify the overlaid candidate; use actual JAR/web hashes. No container/volume/database was recreated. The candidate remains running at `http://127.0.0.1:18080` for independent QA.

## Implemented behavior

1. Shared `ConsumerDetail`/scoped CSS groups natural-ratio official media, complete localized/Japanese names, item/specification, actual selling price, explicitly non-selling reference offer, original conditions and description. Desktop uses two columns at 960px when space permits, up to1120px; mobile uses one natural scrolling column. Catalog and recommendation drawers, including shared private consumer preview, use this presentation. Existing legacy sales drawer keeps its original quantity/configuration callback.
2. Consumer recommendation source disclosures, filename links and file-derived alternate text were removed from JSX. Public image alt is product name plus image number. Internal default gallery labels, sourceUrl/assetKey/hash/order/associations/history remain. Equivalent picture-array reconstruction no longer resets selected/fullscreen image; stable `[id,url]` identity does.
3. `IssueDirectory` keeps a stable paged data owner. Wide layout requires viewport>=1280 **and** content room>=1060, reserving a300px side rail. Four date/ID/short-title clues remain visible; hover/focus expands wrapping titles, click pins, Escape closes/restores focus with suppression, Tab into a link reopens titles. Narrow screens have an in-flow labelled entry. Reduced motion removes transition. One20-row metadata page loads only after desktop primary cards are ready; narrow screens wait for explicit opening, and more pages require explicit action. History and issue bodies remain lazy. This does not add a global persistent cache.
4. The three brand-card duplicate links were removed. Generated initial HTML retains one semantic primary nav with all three crawlable destinations and existing H1/metadata/canonical/JSON-LD. Shipped homePath selected-state logic remains.
5. `RecommendationService.publicNodes` batches current `User.name` lookup only for IDs already derived from published posts. It does not enumerate all users or change publication snapshots/versions. Frontend current node/trip labels prefer canonical current names over late trip responses; public historical attribution is labelled publication-time signature. Unknown/missing names remain neutral. Node is still a public browse filter.
6. `ReservationAdd` renders a translucent44px native button only after the existing actual-quote and entry-specific eligibility gates agree. It rechecks quote start/end on activation and removes at exclusive expiry, restoring focus to that product photo when needed. Existing onAdd/configuration callbacks, quantity and cross-merchant guards remain. No new checkout action. Card-level repeated unavailable prose and disabled bottom actions were removed; detail retains one necessary unavailable explanation. Mouse/touch/Enter/Space do not also open detail/fullscreen.
7. `PublicProductBrowseService.Browse.markedScopeTotal` is computed **before search/category/page filtering**, from the same existing public merchant-scoped dataset and repeatable-read response. No extra full-product request or management-definition fetch is added. Only successful current-scope `markedScopeTotal===0` removes the whole public marked section DOM and spacing; its data owner and independent detail remain mounted. Loading/error/filter-empty are distinct, with compact retry/reset. The field is optional in TS for safe older-response handling; missing never implies zero. Existing same-merchant editing/first-marker access remains in the all-products section.

The directory endpoint still internally builds the existing public-entry projection to derive metadata. The client payload is bounded; this task does not claim that server computation is constant-cost or benchmark production capacity.

## Executed checks and factual limits

| Check | Result and exact evidence |
|---|---|
| Frontend affected suites | **78/78 distinct assertions in10 files passed**. SOURCE-MANIFEST lists the latest receipt per file. Repeated runs are not added to the total. Latest catalog delta: `catalog-once-tests.json`; directory5, reservation2, history22, context13, catalog15, markers6, gallery6, lightbox5, facts3, home1. |
| Backend affected tests | **12/12 passed**: node2, product browse7, HTTP contract3. `backend-r2.log`; Maven package succeeded in `backend-package.log`. Existing test config uses H2 memory, not persisted local PostgreSQL. |
| TypeScript | PASS, `type-detail-once.json` (06:25:10 UTC). |
| i18n / SEO | PASS, `i18n-handoff.json` / `seo-handoff.json` (three SEO assertions); relevant inputs did not change afterward. |
| Build / initial HTML | PASS, `build-detail-once.json` / `prerender-detail-once.json`, bound to final actual local output. |
| Lint / coverage | NOT_RUN: no lint script configured. JaCoCo report skipped absent execution data; test success is not a coverage claim. |
| Scoped diff check | PASS, `SCOPED-DIFF-CHECK.log`, including new-file whitespace check. Whole-tree check reports preexisting unrelated `REAL-PROJECTION-P2-20261107.md:243` blank-at-EOF; that file was not edited. |
| Native browser UI | PASS for the exercised cases in `GUI-R4-PASS.json`, final focused `GUI-DETAIL-ONCE.json`; headless Edge, anonymous isolated contexts, same local stack. Browser processes closed, no page errors or attempted business writes. |
| Local actual public API and data preservation | PASS, `LOCAL-FINAL-READBACK.json`: same7 IDs/images, final JAR/index, original sample values/history/gallery and original served image bytes retained. |

`GUI-R4-PASS.json` covers1440×900,390×844 and375px detail,3-image selection/keyboard/fullscreen/fit/native/Escape/focus, **native CDP touchscreen horizontal swipe, vertical body scroll and native-size pan without image switch**, zero/nonzero/filter-empty marked DOM, directory and Enter/Space quote-expiry behavior. These unchanged interaction modules are reused after subsequent labels/catalog-detail presentation changes.

`GUI-DETAIL-ONCE.json` (06:25:58 UTC) loads the final candidate, validates **114 actual asset responses against the build**, and covers1440/1280/1024/390 widths: catalog Japanese hierarchy, exactly one unavailable explanation, node/query/category retained on close, directory4→20→25 manual paging, Escape/Tab/full-title focus and reduced motion, delayed marked fetch independent of all cards,503/retry/confirmed-zero removal, native touchscreen plus once, keyboard second add, no detail propagation and expiry removal. The earlier `GUI-DELTA.json` is preserved as an intermediate pass, not final artifact evidence.

The local actual API is populated with existing synthetic data, not ITEM14110. It returns24/28 marked items with hasNext; a nonsense search returns0 items, `scopeTotal=0`, **`markedScopeTotal=28` and the same datasetRevision**. Unknown merchant99999999 returns0/0, not all merchants. This directly validates the search-vs-global-total distinction raised by PM. The screenshot's unavailable-node label is not diagnosed as a production scope defect; this UI task did not query production.

## Visual inputs and failures retained

All three user screenshots were actually viewed locally, including the zero-area screenshot via the supported Library materializer on the same OHR0067. PM PLAN retains exact Library IDs and original SHA256s. `reference/transfer.json` contains transfer metadata and must not be publicly shared.

The existing local dataset lacks ITEM14110. Browser acceptance therefore replays the **archived real official original image bytes and source facts**, with clearly synthetic merchant/current-name/quote/list responses intercepted only in the anonymous browser. `ARCHIVED-14110.json` binds original post7/item235/product`f85ea082-5939-438a-bdab-cfbf98398819`, source archive and three image hashes. The visible test merchant883010 is synthetic; it is not a claim about the archived production owner. No rows were imported or changed to prepare the replay. Facts preserved: original1848/reference1518/discount330 JPY,70×15, inclusive Japan dates2026-11-02..08. The images were not cropped, repainted, stripped of text/watermarks or re-encoded.

Final reviewed screenshots: [desktop catalog detail](../../frontend/test-results/consumer-ui-20261108/catalog-detail-1440-once.png), [390px catalog detail](../../frontend/test-results/consumer-ui-20261108/catalog-detail-390-once.png), [expanded issue directory](../../frontend/test-results/consumer-ui-20261108/directory-expanded-1440-once.png), [390px recommendation detail](../../frontend/test-results/consumer-ui-20261108/detail-390-r4.png), [390px zero-marked layout](../../frontend/test-results/consumer-ui-20261108/zero-marked-390-r4.png). These are local replay evidence, not live-production acceptance.

Preserved corrections: `backend-r1.log` compilation error was corrected to User getters/setter; initial missing-14110 precheck stopped before replacement. `RUNTIME.json` initially compared raw serialized property order across JVMs; `RUNTIME-RECONCILED.json` proves deep value/array equality without a second swap. GUI-R0 exposed Escape while hovered/focus elsewhere; fixed with scoped window handling. R1/R2/R3 exposed real native swipe cancellation: a generic button CSS rule overrode gallery `touch-action:pan-y` with `manipulation`. The scoped selector now wins; native swipe/scroll/pan pass in R4. Final screenshot review exposed a duplicate unavailable detail explanation; removed and final catalog/type/build/browser delta passed. Failed receipts/screenshots remain intact.

## D1–D13 handoff to independent QA

This table describes developer evidence, **not an independent acceptance**. Full original PM cases remain authoritative and no requirement is dropped.

| ID | Developer result | Remaining independent verification |
|---|---|---|
| D1 | PASS exercised desktop/mobile/375 natural image/layout and final catalog hierarchy | Independently compare final candidate and all relevant detail types. |
| D2 | PARTIAL: recommendation/catalog public drawers, consumer-alt behavior and shared preview source tested; internal data retained | Authenticated private consumer preview and all route entry variants/failed-image accessibility. |
| D3 | PASS exercised keyboard/fullscreen/focus/native touch swipe/scroll/pan, equivalent-array stability | Independent native double-tap/drag/boundaries and complete browser matrix. |
| D4 | PARTIAL: close/context/deep-link and scope-late-response/pagination/409 components pass | Full real-browser back/forward/refresh/scroll-position/rapid repeated switches on final candidate. |
| D5 | PARTIAL: existing facts tests, eligible/pending/missing/expired guards, quote expiry GUI | Complete Japan-date/channel/conflict/unknown/first-last-day matrix. No real orders. |
| D6 | REUSED source boundaries; current task did not change authorization code | Full authenticated role/ownership/private-preview matrix NOT_RUN here. |
| D7 | PASS affected home/menu/context and generated initial HTML/SEO | Independent desktop/mobile no-JS and history navigation. |
| D8 | PASS affected backend current-name/snapshot and frontend late-response tests, synthetic A/B UI | Full missing/blank/recommendation-only/trip-only combinations; no production rename. |
| D9 | PASS actual same local sample/image hashes and source/history before/after; archive bytes bound | Independent internal provenance check and exact candidate input review. No production data claim for this UI task. |
| D10 | PASS exercised4-clue/full-title/20→25/Escape/Tab/touch fallback/reduced motion/breakpoints | Complete empty/error/selected-beyond-page/long-locale and full screen-reader review. |
| D11 | PASS request traces: first cards usable before directory, one desktop metadata page; narrow explicit; manual next only | Independent final route/scope/409 budget review; server internal cost remains known. |
| D12 | PASS exercised original cart callback single activation via touch/Enter/Space,44px/expiry/no propagation, missing/pending negatives | All card entry variants, real existing quantity/cross-merchant confirmation and delayed quote/node races. No real trade. |
| D13 | PASS exercised whole-region DOM removal, nonzero/filter0/loading/error/retry, pagination/late-scope components and actual28-vs0 API | **Authenticated synthetic first saved mark0→1 and last removal1→0 not run in this task**; verify original editor/all-card entry, visibility refresh, hidden-scope reload and full identity/revision races. |

Independent QA, exact committed-head CI/CodeQL/dependency gates, release artifact packaging/binding and applicable release authorization/review remain pending. The old fc57 CI covers the previous application; it does not cover this uncommitted UI candidate. The unchanged r2 publisher has its own prior independent evidence and was not modified or executed for this batch.

The sole root and existing running candidate are returned to the parent for independent QA. No next batch or production operation is in flight.
