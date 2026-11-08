# Candidate change history

## consumer-ui-20261108-dev4 - INDEPENDENT LOCAL ACCEPTANCE; REMOTE GATES PENDING

- Independent R4 QA: 12 PASS, zero FAIL; actual speech NOT_RUN is an accepted nonblocking limitation. All six genuine scroll failures closed with zero pre-open/post-close delta, identical visible target rectangles and stable focus. Earlier failures remain historical evidence.
- Exact 33-file accepted application digest `54df7134207712abc391ecfd5f6ecdb8fe3548381035e2b7293332a4b6fbda0d`; [portable requirements/test/release record](reports/CONSUMER-UI-20261108-ACCEPTANCE.md) and [accepted inputs](reports/consumer-ui-20261108/accepted-inputs.json). No semantic application edit after acceptance; Git LF normalization is explicit.
- Separate CI delivery change retains all existing checks, builds source-labelled production core/web and uploads their hashes/bytes for independent artifact binding. New exact-commit CI/CodeQL/dependency gates are required. Production remains the separately accepted 20261107.1/fc57/V27; no activation or database operation is included.

## consumer-ui-20261108-dev4 — REAL VIEWPORT RETURN FIXED, REQA PENDING

- Reproduced the identical six dev3 scroll failures before editing: topic-driven background list reset clamped the page to0; hiding the inline directory also removed84px. Retain the initiating list/header/topic context under product detail and restore the original topic on close; explicit issue selection/deep links retain their issue, node/query/category stay intact.
- Preserve obscured directory geometry, capture actual pre-open window coordinates, and restore them only for the same-scope original/rebuilt card after readiness. No card centering, retry delay, preload or old-page viewport write on fallback/new action. Three app files/two tests differ from dev3.
- 33 affected assertions/type/build/prerender pass; final25 browser sequences pass. Original six have0px pre-open→settled-close delta and identical visible control rectangles. Raw baseline6FAIL and all older evidence retained. Two screenshot repetitions are not added to unique cases; no independent acceptance claim.
- Source digest `54df7134207712abc391ecfd5f6ecdb8fe3548381035e2b7293332a4b6fbda0d`; actual local index `8ded1639926a162b7cb1fbaac3cd3eeba5b95743517302e6c7b0da5084c0a8c4`; JAR/publisher/dirty script/data unchanged, same7containers. No production/commit/push. [R4 root cause, before/after and narrow replay](reports/CONSUMER-UI-20261108-R4.md), [manifest](../frontend/test-results/consumer-ui-20261108/r4/SOURCE-MANIFEST.json). Original QA must judge D2/D3/D4 delta; actual-speech NOT_RUN remains an accepted non-blocking limitation.

## consumer-ui-20261108-dev3 — RETURN FOCUS FIXED BY DEVELOPER, REQA PENDING

- Preserve real recommendation detail trigger plus logical post/item/control kind in a stable list owner; restore the existing or rebuilt same-card button on close/Escape/history. Bound async waiting, use a current visible control/heading when opener is missing, cancel stale restoration and focus with preventScroll. Apply shared behavior to private consumer preview. No browse request, price, permission or data change.
- New hook/test plus two existing pages differ from dev2.28 affected assertions/type/build/prerender passed.23 actual browser focus paths are covered by22 initial valid results plus one corrected mobile scroll measurement; rawFAIL and three diagnostic repetitions retained, not erased or counted as extra paths. Page2 repeated operations preserve IDs/scroll and two-stage Escape works.
- Source digest `ac23f30c77adab4d4e67ef12b07b4e44d88b8ce13eef35a0d0b0ffc93c93f0b4`; local index `a2b2e87c8339f4324c0a44394fd302da6f78ca8241eb5eacf25f10694061b119`, JAR/publisher unchanged. Original seven containers, dirty script, sample/original images and all prior QA/release evidence preserved. No production/commit/push.
- [R3 report and narrow QA replay](reports/CONSUMER-UI-20261108-R3.md), [manifest](../frontend/test-results/consumer-ui-20261108/r3/SOURCE-MANIFEST.json). Last independent R2 judgment remains10PASS/D2+D3FAIL/D10 actual-speechNOT_RUN, two earlier P2 closed; original QA must decide dev3 return-focus delta. PM accepted actual-speech NOT_RUN as non-blocking limitation, with no speechPASS/settings changes/new round. Root returned serially for QA.

## consumer-ui-20261108-dev2 — TWO P2 DEVELOPER FIXES, INDEPENDENT REQA PENDING

- Fix homepage reservation eligibility: use already-loaded same-merchant **bookable** trips and a live actual quote, preserving active-trip browsing, node ownership and root quantity rules. Guard the original quantity callback too; reject missing/nonfinite/negative/expired quotes. No preload or new transaction path.
- Scope translucent plus CSS above legacy product-add specificity; retain44px, white icon/dark76% background and visible separated keyboard outline. Actual computed icon contrast>=7.09:1 over white; desktop/mobile screenshots checked.
- Only3 production files and2 tests changed from dev1.62 affected assertions newly passed,20 unchanged-input assertions reused;25 browser case sequences passed on final actual assets, including no/foreign/pending/failed bookable trips, quantity99 and late old-node quote/expiry. Do not count repeated observations/assets as tests or convert this into independent QA PASS.
- New source digest `ef738953ce56778a235a1f437d9faf6f8b61d496f4b1499ff10408738ef7e58f`; actual local index `1989e08d92309fd7b7d9db4fe6ee92f8af4fdf32e3df4941d8d38a32126d54df`; JAR unchanged `1ac5d916...`. Original seven containers, data/provenance, dirty script and all FAIL/release receipts preserved. No production/commit/push.
- [R2 report/reuse limits](reports/CONSUMER-UI-20261108-R2.md), [manifest](../frontend/test-results/consumer-ui-20261108/r2/SOURCE-MANIFEST.json), [five NOT_RUN replay inputs](../frontend/test-results/consumer-ui-20261108/r2/QA-REPLAY-GUIDE.md). Last independent judgment remains7PASS/1FAIL/5NOT_RUN on dev1; original QA must recheck dev2, including D12 remaining entries and D2/D4/D5/D8/D10 gaps. Actual screen reader not run/capability not assessed; no invented authorization blocker. Root returned for serial independent QA only.

## consumer-ui-20261108-dev1 — DEVELOPER_SELF_TESTED, UNRELEASED

- Implement seven PM-scoped UI changes: responsive consumer detail/price hierarchy; remove customer image-source disclosure/file-derived alt while preserving provenance; discoverable bounded issue directory; home-brand nav dedup plus truthful initial HTML; current names for already-public merchant IDs with historical signatures retained; eligible-only44px translucent add action with redundant card status removed; complete marked-section removal only for confirmed pre-search full-scope zero.
- Add same-response `markedScopeTotal` without extra all-product reads; preserve search/filter-empty reset, loading/error/retry, data owner/detail and existing edit/permission/cart/quote boundaries. Fix observed native gallery swipe CSS override and equivalent-array selection reset, plus directory Escape focus behavior.
- Local affected assertions78/78 across10 frontend files and12/12 backend tests passed; type/i18n/SEO/build/initial HTML and real anonymous desktop/mobile browser deltas passed. Repeated executions are not added to unique counts. Lint not configured; coverage not claimed. Authenticated full-role/private-preview/first-last saved-marker QA and exact committed candidate CI remain pending.
- HEAD remains fc57d58; source digest `fd16c0ce0548b5f7fca3f6482820d1facaa7e3125e92bd2bf5489d3b463793b8`. Actual local JAR `1ac5d916ca78498e04ffaad0338af38505fde17c455f991cc34aeb8c6cc84a5b`, index `7b4bea9086e55ead93a7da79553e50dfd2245f1d61f22d0d963a75655141c4b3`. Same7 existing containers, sample/history/original-image bytes retained. No production operation or new stack/database/real transaction.
- [Developer report and D1–D13 limits](reports/CONSUMER-UI-20261108.md), [source/artifact/test manifest](../frontend/test-results/consumer-ui-20261108/SOURCE-MANIFEST.json), final `GUI-DETAIL-ONCE.json` and `LOCAL-FINAL-READBACK.json` distinguish replay UI from actual local APIs and separately accepted production20261107.1/fc57. Failed/intermediate evidence and unrelated dirty files are preserved. Root returned for independent QA; this is not QA acceptance or release.

## visible-browse-v1.frontend.20261107 — UNRELEASED

- Consume backend browse v1 summary pages, complete-scope facets/totals, inline badges and distinct query/shared-dataset revisions.
- Load public product/recommendation sections by viewport intent and subsequent bounded pages; stop eager full catalog/issue traversal on public routes.
- Defer issue directory/history/body/gallery and product detail; bound sale reads, retain pending price/eligibility and existing cart quote/checkout review rules.
- Separate shopping-shell metadata from direct route readiness; preserve root home/menu/merchant context and root quantity flow.
- Preserve resolved-owner management actions and draft/busy/conflict protections, invalidate both product streams after save, reject late generations and changed datasets visibly.
- Keep one execution root; add requirements/design/test-input/request-budget evidence. No migration/cache infrastructure, backend change in this frontend step, dependency installation, runtime replacement, CI, push or production activation.

Source lineage is HEAD e26cab4 plus hash-bound permission-context and backend v1 changes; no new commit or production version is claimed. Final developer tests/type/i18n and source hashes are in the visible-batch evidence manifest. Real performance and release acceptance remain pending original main/QA gates.

## visible-browse-v1.frontend.20261107-p2-detail-pending — UNRELEASED

- Correct the open product-detail action label while price/availability or purchase context remains unverified; preserve disabled and click guards.
- Add five regression cases for pending/rejected quotes, successful eligible quote, verified missing quote and unresolved purchase context.
- Delta evidence lives in `frontend/test-results/visible-batch-20261107/p2-detail-pending`. Prior QA FAIL and build receipts remain immutable; changed frontend requires original-main artifact rebind and original-QA delta acceptance.

## visible-browse-v1.frontend.20261107-p1-gallery-source — UNRELEASED

- Fix public recommendation detail white screen for null/missing/invalid image source attribution. Preserve genuine images, valid links and supplied labels without generating invalid links.
- Add ten attribution boundary cases and close/switch/return regression to the existing recommendation suite.
- Based on committed 634e77c; source-only candidate, no build/runtime/push/production action by frontend owner. Original anonymous QA FAIL remains unchanged; main rebinds minimal assets and same QA rechecks affected detail/navigation.
