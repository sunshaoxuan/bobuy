# Consumer UI dev4 — restore the actual browsing viewport

2026-11-08 UTC. **DEVELOPER_DELTA_PASS / INDEPENDENT_REQA_PENDING / UNCOMMITTED / NOT_RELEASED**. Same sole `media-upload-fix` root, original seven containers, no new executor/stack/database. No production, real login, credentials, business/content writes, commit or push. Last independent judgment remains [R3 QA FAIL](CONSUMER-UI-20261108-R3-QA.md), receipt SHA `5a6fb6a89aa067899bb2909e610c61c1d77359286ba2e4a5a0b1efd542ec1257`: D2/D3/D4 FAIL,9PASS, actual speech NOT_RUN accepted as non-blocking. This report does not independently close that failure.

## Identical six-failure baseline and measured cause

Before editing, all33 dev3 source hashes matched, actual local web remained `a2b2e87c...`, and the **same six QA labels/assertions reproduced6FAIL** in [BASELINE-SIX.json](../../frontend/test-results/consumer-ui-20261108/r4/BASELINE-SIX.json). It uses the original QA browser-only API/original-image fixtures, with layout/history/focus traces added; no app or runtime change preceded it. Original QA report SHA `51e19fe7c1cdf60f448e068c168eefcf2069e0079f286ccb729c8026127ee189` and all previous failure records remain unchanged.

The trace establishes two concrete layout transitions:

1. Home/current product opening sets `topic` for the item deep link. That same value also selected the background issue list and article/header. The list owner changed identity and discarded its rows during the fetch. On mobile home-name, **scroll637 / cards1 / max887 → cards0 / max0 / scroll0**, before Drawer locking. The new issue content later grows max to932, but scroll stays0. Desktop shows the same height contraction. R3 focus(preventScroll) then focuses the correct button at scroll0; it cannot restore an already-clamped viewport.
2. Selected mobile issue needs no list rebuild, but `.issue-directory[hidden]{display:none}` removed84px above the cards. Trace shows document1609→1525, max765→681 and scroll74→0 when the directory is obscured. It grows back on close without restoring the old location. The observed geometry change/scroll adjustment is recorded; no unrelated browser-internal mechanism is asserted as the sole cause.

Simply assigning old scroll is insufficient for current-list geometry: original mobile name was at754px with scroll8; the newly inserted issue heading/article placed it at915px. Therefore R4 preserves **both originating list context and viewport**, rather than centering a card or accepting offscreen focus. The prior selected-name probe's corrected before-open measurement remains valid for that single path; it did not cover the other real failures. R4 does not reuse the rejected blanket R3 scroll PASS.

## Minimal fix and URL behavior

Three application files and two tests differ from dev3:

- `RecommendationBrowse.tsx` retains the initiating browse scope, original topic and search while its product detail is open. The background current/history/selected list and header keep their original identity, rows and layout; no extra selected-issue list request or refetch is introduced. Detail still has the existing addressable topic+item URL and loads only its requested post.
- **Closing a card-opened detail restores the original topic context**: if the feed had no topic, remove the topic introduced solely for that detail; if an issue was explicitly selected, retain it. Node/query/category remain unchanged. Opener-free deep links retain their issue, and changed node/query/auth scope cannot restore an old origin. Browser back returns through the same original context. This is an intentional return-behavior correction; it avoids silently turning a feed product click into permanent issue navigation. Explicit issue-directory/title navigation remains issue navigation.
- `issue-directory.css` keeps an obscured directory's geometry with `display:block;visibility:hidden;pointer-events:none` under its existing hidden attribute. It remains unavailable for interaction/visibility while the overlay is open, without removing the84px inline space or reflowing the cards.
- `useDetailReturnFocus.ts` captures actual window X/Y at activation, before routing/locking. After list readiness/close, it restores those coordinates **only for the same-scope surviving or rebuilt original card**, then focuses with preventScroll. No scrollIntoView, fixed delay/retry, pinning loop or uniform card centering. Missing-opener/fallback, new-scope/user-action and expired restoration do not apply the old viewport.
- Hook and recommendation-history tests cover pre-open capture/clamp recovery, scope and stale cancellation, stable list identity/request budget and exact original URL, explicit issue routes and opener-free deep links.

User-visible criterion: compare stable pre-open and settled post-close viewport, not the locked/open state. For the six unchanged input paths, raw Y delta must remain<4px **and** the correct control must remain visible. The original control rectangle is also preserved here. Genuine scope/content removal uses the existing current visible fallback and browser scroll range; it does not force the old card into view or apply an old-page snapshot. The existing500ms pending-DOM bound remains a cancellation/fallback deadline, not a scroll-repair delay.

## Final actual build results

[ROOT-CAUSE-AND-SIX-RESULTS.json](../../frontend/test-results/consumer-ui-20261108/r4/ROOT-CAUSE-AND-SIX-RESULTS.json) binds raw before/failure/final traces, rectangles, focus, URL and per-case network. The final run waits network idle, fonts and six frames after each sequence, then repeats scroll/visibility assertions. **All six now have0px delta**, with the same pre/post control rectangle:

| Original failed path | dev3 before→after | final dev4 before→after | final control top–bottom |
|---|---|---|---|
| Home photo1440 |41→0|41→41|661.77–899.77 /900px|
| Home name1440 |539→0|539→539|413.77–486.20 /900px|
| Home photo390 |516→0|516→516|344.67–499.67 /844px|
| Home name390 |637→0|637→637|376.67–466.33 /844px|
| Current name390 |8→0|8→8|754.28–843.94 /844px|
| Selected photo390 |74→0|74→74|688.78–843.78 /844px|

**33/33 affected assertions passed**, `r4-final-tests.json`:7 hook +26 recommendation history, actual reports counted once. Type/build/prerender passed in `r4-type`, `r4-build`, `r4-prerender`. **25/25 final browser sequences passed** in [GUI-final.json](../../frontend/test-results/consumer-ui-20261108/r4/GUI-final.json): the six failures plus home/current/selected photo/name at1440/390, close/Escape/two-level fullscreen Escape/back, real404, no-opener and removed-target fallback, stable current-list/request budget,48-card/page2 repeated operations, private readonly preview and two late-restoration cases. Page2 keeps IDs and scroll8681/13685 across repeated button/Escape/back.

The six original failing assertions and<4px tolerance are unchanged; final checks additionally require visible focus and exact originating URL. One obsolete “opening current detail must fetch a new selected list” fixture was replaced with a stable-background/no-extra-request case because eliminating that reset is the fix. The two delayed-result tests now change to a **new query scope** and delay its selected list: after deadline or a new search action, late data cannot change focus/scroll, and old-snapshot scrollTo calls remain0. They preserve the original cancellation intent without expecting the removed background reload.

All279 actual final JS/CSS responses match the final build; page errors0, attempted server writes0, browsers closed. [HOME-VISUAL.json](../../frontend/test-results/consumer-ui-20261108/r4/HOME-VISUAL.json) separately repeats the two home-name cases for before/after screenshots,22 asset matches, not two additional distinct tests. Developer inspected [mobile before](../../frontend/test-results/consumer-ui-20261108/r4/home-visual-before-home-name-390.png) and [after](../../frontend/test-results/consumer-ui-20261108/r4/home-visual-after-home-name-390.png); target, viewport and original URL agree. Baseline6FAIL, all older FAILs and raw records remain intact. No failure was converted by lowering a threshold or using the open-state coordinate.

## Version, artifacts and preservation

Candidate `consumer-ui-20261108-dev4` remains on uncommitted HEAD `fc57d58e773f730158cc827a1c4d221ebce1a594`. [SOURCE-MANIFEST](../../frontend/test-results/consumer-ui-20261108/r4/SOURCE-MANIFEST.json) SHA **`44b38dd95f00ef7fe4a1a46ad957551f792ec69c7d32a2487f05bada064270f6`**; ordered33-file source digest **`54df7134207712abc391ecfd5f6ecdb8fe3548381035e2b7293332a4b6fbda0d`**. It binds all five dev3→dev4 file hashes, unchanged configs, [full review patch](../../frontend/test-results/consumer-ui-20261108/r4/CANDIDATE-SOURCE.patch), tests and built web files.

| Actual local / protected input | SHA256 / status |
|---|---|
| Final web index | `8ded1639926a162b7cb1fbaac3cd3eeba5b95743517302e6c7b0da5084c0a8c4` |
| JAR unchanged, not restarted | `1ac5d916ca78498e04ffaad0338af38505fde17c455f991cc34aeb8c6cc84a5b` |
| Original production publisher unchanged/not run | `78f0ac580ed0d2647954b7fc56a262afa6795d0786d86d4559383fc815f39e13` |
| Unrelated dirty scripts/local-test.ps1 unchanged | `4e8a397f1d819ced5eb6e23d601b005c74a0a94a963547e1ccae2c5099ffb4b9` |

Only original local web files were updated once after tests/build. [Final readback08:21:12 UTC](../../frontend/test-results/consumer-ui-20261108/r4/LOCAL-FINAL-READBACK.json) verifies the same7 running container IDs/images, actual artifacts, protected synthetic sample/history/provenance/gallery and original served image bytes unchanged. Marked total28, no-match scope0/global28 and unknown merchant0 remain correct. This is anonymous local readback, not a fresh production/database-wide audit. Original QA mock/anonymous-read and archived-image boundaries remain; no real login or transaction.

## Independent narrow handoff

R3 independent D2/D3/D4 FAIL remains the last official result until original QA rechecks exact dev4. Reuse unchanged relevant source/config/JAR evidence for prices, role/ownership, sources/images, names, marked lifecycle, original two plus P2, and unaffected request behavior. No broad seven-item rerun or new login/cleanup gate is added. Actual speech remains **NOT_RUN / accepted non-blocking limitation**, with four-language keyboard/ARIA/AX evidence retained and no settings/software/reader round.

Prepared original six + necessary second-page/two-level/back/late-scope checks:12 sequences. From the sole root choose a fresh label:

```powershell
node frontend/test-results/consumer-ui-20261108/r4/prepare-qa.mjs r4-recheck
node frontend/test-results/consumer-ui-20261108/r4/qa-r4-recheck.mjs
```

The generated file filters the final inspected25-case script to those12, retains strict stable pre/post coordinates, rectangle/focus/URL and raw network traces, and labels it replay requiring original QA judgment. No valid credentials or actual API writes. It does not relabel developer PASS as independent acceptance. Broader identified cross-impacts can use the remaining final-case evidence, not speculative full regressions.

The existing final candidate remains on localhost18080 for serial independent QA. All owned processes/browsers end before the final handoff receipt; original seven containers stay running. That receipt records root-return time. No next batch, commit/push, CI/security gates, core+web release packaging or production action is in flight. Subsequent release still needs the complete application candidate, including this batch's existing backend read projections; oldfc57 CI does not cover it.
