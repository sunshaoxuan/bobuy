# Recommendation directory — lifecycle R7

Status: ready for independent source/formal-package QA, not deployed. Baseline 82b8daf7fe275d6dd623b36621f1cf2596dc0e98, branch recommendation-menu-contrast-20261109. This follows the preserved 13:24 report; it does not replace old failures or the denied R6 operation.

## Problem and product change

The mobile directory waited until the first tap before requesting its first lightweight page. Independent actual-bundle diagnosis measured 0 requests/links while closed, then a pending spinner with no invented current, and finally eight genuine server rows with exactly one current at its original position. The first diagnosis mislabeled the visible article as primary-ready; SOURCE-CORRECTION.json preserves the correction: below-fold occurrence cards had not activated, so their primaryReady callback had not fired.

Once the selected article is actually available, its directory may preload one summary page on mobile and desktop. Ordinary browse without an article still waits for the primary list. Explicit early mobile open remains available. This eliminates tap-triggered startup delay, retains pending/error/retry behavior, and reuses the page across toggles/width changes. No complete item fetch was added. Selection still neither inserts nor reorders rows. Current derives only from loaded server rows.

Four files changed relative to the prior frozen input: IssueDirectory.tsx (enable mobile preload), RecommendationBrowse.tsx (article readiness), IssueDirectory.test.tsx (20 targeted cases), api.ts (type-only REVIEWED_SOURCE | UNKNOWN contract alignment). CSS, locales, prior report and other frozen frontend inputs are unchanged.

## Verification

- 20/20 unique component tests PASS. New cases cover pending data without fake selection, loaded server order/current, early open/readiness/width reuse and failed-preload retry. Exact final-source TypeScript and 1388-key four-language checks PASS.
- Complete single768MiB Vite build plus home prerender PASS at 2026-11-09T14:17:39.155Z; 46 files, static manifest bc03a82ef5d4e19e3d6317c975578169a6672572030817d091450dc0e848a9f7, FORMAL-WEB.tar SHA256 914bd12de40be5b31b000489eb9e25639322b9f615f83c05221ac5f15db34595. No Java, Docker, database service or dependency installation.
- Actual full bundle: 19/19 unique anonymous combinations PASS, 177 measured states. 358/375/390/1440px × four languages, selected issue7 at desktop/mobile, and no-selected desktop. Touch/pointer toggle, hover, keyboard focus/Enter/Escape/focus return, long titles, directory scrolling and desktop page scrolling were checked. 228/228 static responses hash-match the exact bundle. 57 anonymous public GETs supplied unchanged real bodies; no artificial facts or CSS injection.
- Original checkSnapshot assertions are byte-identical: 19c8236708cb6634bc8e858a6c0273d5b98a691f605a14184b2230e8a3d0168d. Exactly-one-current remains 1. All mobile closed snapshots now contain loaded real rows and exactly one current while the nav stays hidden. No modified R6 assertion or command was used.
- Real composed minimum contrast: text 5.530:1, necessary borders 4.282:1, link focus 5.279:1, toggle/control focus 4.645:1, icons 5.821:1. Original geometry/overflow thresholds remain unchanged.
- Final 358px traditional Chinese and 1440px selected-issue7 screenshots were visually inspected. All own browser/preview resources closed at 2026-11-09T14:19:43.155Z.

## Historical denial and remaining boundaries

The old R6 command was denied before execution and never retried. Its exact reason remains in ../REVIEW-DENIAL.json. The independent diagnosis was normally reviewed and executed; after a substantive product-source fix, a new exact full build was normally reviewed against the unchanged original R5 strict checks. This does not override the old denial. Original 384MiB OOM, type fixture failure, CJK failures, failed bundles, original R5 mobile failure, manifests and denial are preserved and hash-checked.

Date rendering consumes a strict LocalDate without timezone conversion/title/publication-date fallback. Source persistence and the merchant date-review form belong to the separate backend/date integration candidate. The type-only union is aligned; this task did not implement that form or populate any dates. Public total/supplier/new date DTO full-runtime integration remains NOT_RUN because the public API captured for this browser run does not include the new menu DTO. Do not count the component fixtures or anonymous old-contract public replay as those fields' end-to-end acceptance. Original Library screenshot materialization is still unavailable due to official helper os.setxattr failure; no helper patch/raw download/executor switch occurred.

## Artifacts and ownership

All exact new receipts, full patch, delta hashes, static list, archive, screenshots and browser/HTTP evidence reside at .task-tmp/menu-contrast-20261109/r7-lifecycle. The preview uses configFile:false, no server/preview proxy, strict loopback4187, and a501 local API guard. New temporary anonymous contexts use no user profile/cookies/token, allow GET/HEAD public data only and block all writes. No content Edge/hospital tab, production service, business data, index or commit was touched. Shared index remains a27acc24c17f71dfa773b82a289e79c0a215d70c676651ae32fcb0dbbd955953. Source is frozen for QA.
