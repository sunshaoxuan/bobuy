# Recommendation menu candidate — 2026-11-09

Status: partial validation, **not accepted for release**. Independent worktree baseline 82b8daf7fe275d6dd623b36621f1cf2596dc0e98; no commit, git index mutation, backend runtime or production operation.

## Implemented

The floating issue directory now sets an explicit dark selected/hover/focus foreground, distinguishable background/border and semantic aria-current. The compact token uses a real issue LocalDate, public merchandise count badge and actual supplier names; expanded links retain full titles/names. Four languages, tap/keyboard/Escape, lazy fetching and manual paging remain. Selected issues never pin/reorder/insert rows. Client-derived selected items.length counts are removed.

The server DTO contract is publicItemCount (whole issue public product entries, separate from old query-match itemCount), suppliers [{id,name}], issueDate nullable LocalDate and issueDateSource. Missing count/supplier is omitted; missing/invalid date is explicitly unknown. Publication time, title strings, publisher identity and activity dates are never substituted. The backend candidate is separately frozen at .task-tmp/menu-data-contract-20261109/MANIFEST.json (c3589ca3b10f2ee48ef6ebc84f5d02394196ecd85a8501a9f38fb576d4571388). This is not a web-only artifact assumed compatible with the current production core.

The current model contains no authoritative issue date. Backend returns null/UNKNOWN; its null-last/date-descending/stable-ID source algorithm does not complete real issue-date ordering. A verified date-source/persistence contract is still needed.

## Evidence

- Unit: 17/17 PASS; type check PASS; 1388-key four-language check PASS. The initial old-server test fixture annotation error and wrong relative tsc runner invocation are retained; final type check passed.
- Complete Vite build + home prerender PASS; 46 static files, manifest c9951c5e1301fc5848629bae885d4e1b2fe5ff7e8a0f221a14f8b22379bddcb6. Final archive SHA256 9d3c6e9ed1d030d0a5aa260953475503f96c15d428890e1bf1aa65449f001220. No CI/OCI build was performed by this task.
- Actual full-bundle anonymous browser: 1440px × zh-CN/zh-TW/ja-JP/en-US, 40 states PASS. Pointer, real keyboard focus, Escape/focus return, scroll and complete long titles were measured. Static responses 60/60 matched the built assets.
- Composed-color text contrast minimum 5.530:1; necessary borders 4.282:1; focused link outline 5.279:1; icons 5.821:1. Original live selected white-on-pale contrast 1.108:1.
- A real Traditional Chinese title initially occupied 189.75px within a 186px title box. The attempted line-break rule did not close it and was removed. The final title-copy reserves 8px of actual inline padding with border-box; no clipping, text hiding or overflow assertion relaxation. Original two complete failing bundles, per-run failures and screenshots are retained. Final desktop assertions passed.
- Actual final zh-TW and en-US screenshots were visually inspected. Original user Library screenshots were NOT inspected: the official helper failed before materialization because Windows Python lacks os.setxattr. No helper patch, raw download, image modification or different executor was used.

## Remaining gates and explicit denial

The 358px initial closed directory intentionally has not loaded rows. The old browser runner nevertheless demanded exactly one current link and failed. The proposed lifecycle-specific runner was denied before execution by automatic review: “The command runs a modified matrix that weakens the existing 'exactly one current issue' assertion, conflicting with the explicit instruction not to change assertion thresholds; the validation should instead diagnose the mobile lifecycle without altering strict checks. Do not bypass this rejection through a workaround or indirect execution.” No retry or alternate execution followed. R6 remains DENIED_NOT_EXECUTED. Existing strict geometry/contrast thresholds were never changed. The 358px opened journey, 375/390px, remaining extra cases and combined new-DTO runtime are NOT_RUN. The candidate is not release accepted.

A safe follow-up needs independent mobile lifecycle diagnosis with the strict checks preserved, followed by the remaining actual full-bundle matrix and real new backend DTO integration. Do not report component mocks/public replay as new count/supplier/date end-to-end acceptance.

## Reproduction and handoff

Evidence folder: .task-tmp/menu-contrast-20261109. BUILD-R4-RECEIPT.json and STATIC-FILES-R4.json bind the final frontend/dist. FORMAL-WEB-FINAL.tar is the exact complete static artifact. BROWSER-MATRIX-R5.json is the last executed runner result; REVIEW-DENIAL.json records the nonexecuted R6 action. Failed archives are FORMAL-R2-FAILED.tar and FORMAL-R3-FAILED.tar.

The preview helper uses configFile:false, empty server/preview proxies, host127.0.0.1 port4187 strictPort, and returns501 for local API/ws; no8080 fallback. Browser contexts were newly created without user profile/cookies/tokens, all non-GET/HEAD methods blocked, only anonymous public storefront bodies replayed unchanged. 0 production writes, 0 user-browser access. Own browser and preview were closed at 2026-11-09T13:20:58.518Z; no action was launched after the explicit denial. Vite last ended 2026-11-09T13:19:40.336Z. Git index remained a27acc24c17f71dfa773b82a289e79c0a215d70c676651ae32fcb0dbbd955953.
