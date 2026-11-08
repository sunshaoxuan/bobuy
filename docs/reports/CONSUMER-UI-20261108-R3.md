# Consumer UI dev3 — recommendation detail return focus

2026-11-08 UTC. **DEVELOPER_FOCUS_DELTA_PASS / INDEPENDENT_REQA_PENDING / UNCOMMITTED / NOT_RELEASED**. Same project, sole `media-upload-fix` root and existing seven containers. No production calls, account/content/data writes, real login, commit/push, new executor, stack or database. The separately accepted production20261107.1/fc57 release is unchanged.

Original [R2 independent QA report](CONSUMER-UI-20261108-R2-QA.md) and [receipt](../../frontend/test-results/consumer-ui-20261108/qa-r2/QA-RECEIPT.json), SHA `0acf34bc4189aa6052b5ae5dc56feab4cf23ac069302984d1e2124da6ba7c2f6`, remain unchanged: **10PASS / D2,D3FAIL from the same return-focus P2 / D10 actual speech NOT_RUN**. The prior two plus eligibility/contrast P2 were independently closed. This developer correction does not replace the next independent decision.

## Root cause and minimal implementation

RecommendationBrowse conditionally removes the detail when item leaves the URL; RecommendationProductDetail itself also returns null without an item. The Drawer is therefore unmounted immediately. Its original focus restoration has no stable page owner. Opening a current/home item also introduces topic and rebuilds the card list; remembering only the old DOM button is insufficient. Selected-topic cases retained the original button but still lost focus to BODY, as original QA recorded.

R3 changes two existing application files and adds one shared hook plus its test file:

- `useDetailReturnFocus.ts` stores the real initiating HTMLElement, logical post/item key, control kind and current browse scope. On detail→closed transition it first uses the still-visible original button, then the same control on the rebuilt logical card, then another valid detail control on that card. A deep link can use its logical item without an opener. The list owner observes only its loaded DOM/readiness, waits at most500ms for rebuilding, and adds **no fetch, page traversal or preload**.
- If that item is no longer rendered/filtered out, use a current visible detail control or the focusable current heading. Never explicitly focus BODY or an old merchant/identity element. Focus uses `preventScroll:true`. Pending restoration ends on a new pointer/keyboard action, new detail/scope or unmount; deadline fallback is final, so a late result cannot steal focus afterward.
- `RecommendationBrowse.tsx` passes the actual currentTarget from photo/name/conditions controls, exposes logical card/readiness/fallback attributes and owns restoration through URL closes, Escape and browser back. Existing URL mutations, pagination, request isolation and modal/fullscreen behavior remain.
- `PublicRecommendations.tsx` applies the same hook to the shared issue/private consumer preview and its photo/name/preview/conditions triggers. Existing private-preview permissions/readonly behavior, sources, original images and prices are unchanged.

The current product UI uses pagination, not a newly introduced virtualizer. Async remount and detached-card tests exercise the removal/rebuild conditions a virtual visible window presents; no claim is made that a new virtualization implementation was installed or tested.

## Exact candidate and actual local output

`consumer-ui-20261108-dev3` is still an uncommitted working tree on HEAD `fc57d58e773f730158cc827a1c4d221ebce1a594`. [SOURCE-MANIFEST](../../frontend/test-results/consumer-ui-20261108/r3/SOURCE-MANIFEST.json) SHA **`481c604f27c7f2424657b125ce1d1af93d66c327f006fd593d3d40a1538b1dc4`**, ordered33-file source digest **`ac23f30c77adab4d4e67ef12b07b4e44d88b8ce13eef35a0d0b0ffc93c93f0b4`**. It binds every before/after source SHA, unchanged configuration, full web output and [review patch](../../frontend/test-results/consumer-ui-20261108/r3/CANDIDATE-SOURCE.patch). Only four files differ from dev2: the two pages, new hook and new six-case test.

| Actual local item | SHA256 / result |
|---|---|
| web index | `a2b2e87c8339f4324c0a44394fd302da6f78ca8241eb5eacf25f10694061b119` |
| JAR unchanged | `1ac5d916ca78498e04ffaad0338af38505fde17c455f991cc34aeb8c6cc84a5b` |
| Original production r2 publisher unchanged/not run | `78f0ac580ed0d2647954b7fc56a262afa6795d0786d86d4559383fc815f39e13` |
| Original dirty scripts/local-test.ps1 unchanged | `4e8a397f1d819ced5eb6e23d601b005c74a0a94a963547e1ccae2c5099ffb4b9` |
| Seven existing containers | Same IDs/images, running; only existing local web files updated, no backend restart |

[Final readback](../../frontend/test-results/consumer-ui-20261108/r3/LOCAL-FINAL-READBACK.json) at **07:44:39 UTC** verifies actual artifacts, original synthetic post/item/product/provenance/gallery/history values and served original image bytes unchanged. Marked total remains28, no-match search scopeTotal0 still markedScopeTotal28/same datasetRevision; unknown merchant0 has no fallback. No persisted business data or production was changed. Original image replay and anonymous browser-only fixture boundaries remain as in prior QA.

## Executed tests and preserved correction

- **28/28 affected assertions passed**, `r3-final-tests.json`: six hook cases (connected control/preventScroll, async same-kind rebuild, removed/virtualized item fallback, opener-free deep link, new-action/scope cancellation, bounded wait/no stale late focus) and22 existing recommendation history/request/price/source cases. Final TypeScript/build/prerender receipts `r3-type-bound`, `r3-build-bound`, `r3-prerender-bound` passed and match actual output. Unchanged backend, i18n/SEO, permissions, plus eligibility/contrast and marker lifecycle evidence is reused within its prior limits; no full-suite rerun or new coverage claim.
- **23 distinct browser case paths covered on the same actual build**:12 home/current/selected × photo/name ×1440/390, two fullscreen→inline→detail→card Escape and route-back sequences, two realHTTP404 name entries, two direct-deep-link/detached-opener fallbacks, one delayed rebuilt card, two48-item/page2 repeated close/Escape/back sequences, and two private-preview name entries. URL node/query/category/item behavior, focus target and no simultaneous reopen were checked. Page2 IDs remain unchanged; scroll8681 desktop and13685 mobile remained exact through repeated closes. Private preview remains readonly.
- Raw [GUI-focus.json](../../frontend/test-results/consumer-ui-20261108/r3/GUI-focus.json) is **preserved FAIL:22PASS plus one bad scroll measurement**, not rewritten. Every focus assertion passed; the mobile selected-name test compared **while Drawer was open** to after close and observed84px. [Three diagnostic repetitions](../../frontend/test-results/consumer-ui-20261108/r3/GUI-scroll-probe.json) record before-open539 → Drawer-lock455 → after-close539, and native focus calls carrying preventScroll:true. This identified the wrong measurement baseline, not a source correction.
- Only that measurement was rerun with correct before-open/after-close baseline in [GUI-focus-final.json](../../frontend/test-results/consumer-ui-20261108/r3/GUI-focus-final.json): PASS, actual BUTTON/name focus, full URL context retained,539→539. [FOCUS-RESULT.json](../../frontend/test-results/consumer-ui-20261108/r3/FOCUS-RESULT.json) explicitly composes22 valid paths plus this corrected one; diagnostic repeats are not counted as new distinct paths. Application/build did not change during this correction. All257 initial,33 diagnostic and11 corrected asset responses match the bound build; they are asset observations, not301 tests. All page errors/attempted server writes are0 and browsers closed.
- Other preserved preflight failures: initial hook test mocked client rects but left viewport geometry zero, so correctly selected the heading instead of its supposed visible other card; consistent mocked geometry fixed that fixture. Initial TypeScript rejected a test cleanup returning VitestUtils; void cleanup fixed it. Final28/type/build passed. Old failures and original independent QA evidence remain intact.

Actual screenshots inspected: [desktop restored photo](../../frontend/test-results/consumer-ui-20261108/r3/focus-selected-restored-1440.png), [mobile page2 name focus](../../frontend/test-results/consumer-ui-20261108/r3/focus-page2-restored-390.png), plus corrected mobile name and fallback DOM focus records. These are local original-image/synthetic-response acceptance, not production or real authenticated persistence claims.

## Narrow independent replay and reuse

Original PM requires narrow desktop/mobile home/current/selected entry and two-level Escape recheck. Prepared **`r3/focus-qa-narrow.txt`** contains those14 sequences, with scroll measured before opening. From the same unique root, choose a new label:

```powershell
node frontend/test-results/consumer-ui-20261108/r3/prepare-browser.mjs qa-focus-recheck focus-qa-narrow.txt
node frontend/test-results/consumer-ui-20261108/r3/browser-qa-focus-recheck.mjs
```

The inspected helpers come from original `qa-r2/browser-focus-final.mjs`, actual built assets from localhost18080 and archive originals; every API stays browser-intercepted. The generator labels these as developer/replayed evidence. QA must inspect and record its own independent judgment rather than relabel an old developer receipt. No real credentials, user browser or production route is involved. For an identified cross-impact only, `focus-replay.txt` supplies the corrected23-case input; it is a prepared input, **not another completed23-case run**. Original `focus-cases.txt`/generated initial script retain the bad measurement for diagnosis and are not the recommended replay file.

Reuse original D1/D4/D5/D6/D7/D8/D9/D11/D12/D13 relevant-source evidence. The gallery/fullscreen intersection and private-preview return path were newly exercised above; no need to repeat unchanged permissions, prices, marked-service/data lifecycle or all prior tests. The original two P2 remain independently closed, with their Storefront/ReservationAdd/CSS hashes unchanged from dev2. D2/D3 still require original QA's exact-dev3 decision; developer PASS is not that decision.

**Actual speech reader remains NOT_RUN.** Per parent relay, PM accepted it as a non-blocking verification limitation with existing four-language keyboard/ARIA/native AX evidence. No speech PASS is claimed, no system setting/software was changed and no extra reader round is requested.

The existing candidate is left running for original independent QA. All owned browsers/commands are terminal and no Java helper was started. The final handoff receipt records root-release time. No next batch, commit/push, CI/security gate, release packaging or production action is in flight; those remain later separately authorized work.
