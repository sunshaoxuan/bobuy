# Product-card detail simplification — local follow-up r1

Status: **local implementation and focused checks complete; uncommitted, not built, not published, not independently accepted**. Base HEAD is `7828194be02d1e1396f304dfd24124a06b35fc32`; the new working-tree candidate is `consumer-card-detail-local-r1`. It is separate from the frozen failed release `20261108.1` and from current recovered production `20261107.1 / fc57d58e`.

## Requirement, observed wording and design

User feedback: “Bobuy为什么有一个查看详情和重要适用条件，不就是查看详情么？点一下产品不就看了么，为什么搞这么啰嗦？” This follow-up authorizes local simplification only. The denied mobile-fix production replacement is not retried or reinterpreted as authorized.

The exact resource is `rec.conditions_detail`: zh-CN “查看详情与重要适用条件”, plus equivalent zh-TW/ja-JP/en-US. It existed in **both fc57 and 7828194**. In both versions, `pages/RecommendationBrowse.tsx` renders the button on public recommendation product cards, and also reuses it on service summaries. `pages/PublicRecommendations.tsx` contains a second conditional product CTA in the shared `RecommendationIssue` preview component; its public default uses RecommendationBrowse. Thus the wording is customer-visible, not merely an admin label. The original message alone cannot establish which version the user saw.

Before editing, a fresh anonymous GET-only public read at **2026-11-08 13:19:27–13:19:30 UTC** confirmed `/recommendations` HTTP200, 24 visible long-label buttons and already-named native photo/name buttons. The loaded `index-DybI121N.js` SHA256 `226e1fa0c4a370ea80cc3173fdb29d506040ea2c14c9e2fac6f314571dce7fba` matches the recovered fc57 artifact. See [PUBLIC-BEFORE](../../frontend/test-results/consumer-ui-20261108/card-detail-local/PUBLIC-BEFORE.json) and [actual screenshot](../../frontend/test-results/consumer-ui-20261108/card-detail-local/current-fc57-card.png), inspected as pixels. No real order, authentication or existing user browser was used.

Local interaction contract:

- Clicking noninteractive card text/space opens the same original product/item detail. Existing native photo/name buttons remain named and keyboard-accessible; Enter/Space use native button behavior. The article is not given a misleading button role/tab stop, and no interactive controls are nested inside another button.
- The common `openCardDetail` helper ignores existing links/buttons/forms, management action groups, modified/secondary clicks, prevented events and active text selections. It focuses the original photo button with preventScroll before invoking the original detail callback, preserving the existing focus/scroll owner and deep-link logic.
- Remove product “details and important conditions” CTAs and the redundant preview expand icon. Service summaries retain one concise “查看详情 / 查看詳情 / 詳細を見る / View details” action because their full restrictions live in the issue rather than a product photo drawer.
- Original/reference/actual prices, units, offer/coupon dates and full restriction/description content remain in their existing summary and detail components. No price, image, provenance, role, purchase eligibility, API, data or permission contract changes.

## Minimal write set and change record

Nine runtime files: the new `components/openCardDetail.ts`; the three existing public product/recommendation page components; one cursor-only rule in `browse-pages.css`; one resource value in each of four locale dictionaries. Three test files: new helper tests plus narrow additions to RecommendationHistory and PublicProductCatalog tests. No dependency or backend/migration change.

The change covers current recommendation cards, regular/marked catalog cards and the shared preview card. It retains explicit issue navigation, reserve/quantity/cart behavior and management permission checks. Clicks on management labels and controls are excluded from detail delegation. The original `useDetailReturnFocus.ts`, image viewers, reservation eligibility component and issue-directory sizing stylesheet are unchanged.

All exact raw SHA256 values, existing HEAD blob hashes and the local source digest are in [SOURCE-MANIFEST](../../frontend/test-results/consumer-ui-20261108/card-detail-local/SOURCE-MANIFEST.json); scoped tracked differences are in TRACKED-SOURCE.diff in the same directory. No Git stage, commit or push was performed. Source is ahead of the old frozen artifact; old CI/artifact hashes cannot be presented as checks of this new local candidate.

## Actual focused verification

| Check | Result and boundary |
| --- | --- |
| Five affected Vitest files, one worker | **59/59 PASS**: helper5, ReservationAdd3, return-focus hook7, PublicProductCatalog16, RecommendationHistory28. Includes eight new tests, original conditions retained, same scoped deep link, route close, existing purchase/permission negatives and action propagation. Synthetic/jsdom only. |
| Initial TypeScript check | **FAIL retained**: new test supplied unsupported ByRoleOptions exact:true. Application source was valid. TYPECHECK-R0.json records exact TS2769. |
| Final correction | Only the new test removed unsupported exact:true; a string accessible-name query already matches exactly. Final helper **5/5 PASS** (VITEST-R1.json), unchanged other54 results reused; no application edits after the 59-test run. |
| Final TypeScript | **PASS**, `tsc --noEmit`, 13:27:13–13:27:21 UTC; no emitted bundle/build. |
| i18n | **PASS**, 1339 keys, application references and missing-key negative fixture. Locale keys unchanged, four existing values shortened. |
| Whitespace/scoped diff | **PASS**, git diff --check on affected source. |
| Actual post-change desktop/mobile GUI, native touch and speech | **NOT_RUN**. No new application build/server/browser test was started for the changed code. jsdom/native-button interaction tests do not establish actual pixels or production acceptance. Independent narrow QA remains required. |
| Hosted CI, production artifact, upload, production replacement | **NOT_RUN / NOT_AUTHORIZED_THIS_TASK**. No remote CI, build, push, upload or activation. |

## Preserved production evidence and mobile issue boundary

Previous production facts remain unchanged: new 7828194 was active at **12:54:23 UTC**, then recovered application-only to **fc57 at 13:09:55 UTC** after real mobile failure. Public desktop/mobile200 was verified at **13:11 UTC**. All38 current business tables, full V27 structure/migration history and protected services were preserved; no database restore or migration replay. The new public read above still binds to recovered fc57. This task issued no server mutation or transaction.

The complete [production report](CONSUMER-UI-20261108-PRODUCTION.md) retains SHA256 **555be0b2d088baabdcb9054ecd053307d3a4127438a6d6eb6a8137f6a9508952**; its FINAL-RECEIPT retains **d06460fa34c7605c6e9977a50cebbd5ddcbf5d1110919367b5beb4df8e1a42cd**. Original recovery results, images archive/metadata, f71 publisher, prior PASS/FAIL and snapshots are not rewritten. `scripts/local-test.ps1` remains **4e8a397f1d819ced5eb6e23d601b005c74a0a94a963547e1ccae2c5099ffb4b9**.

Mobile clipping evidence from the attempted new UI: a358px flex-column directory container, primary width1159.34375px on `/` and `/recommendations`, width760.828125px on selected issue `/recommendations/7`; right-column photo x≈610px is inaccessible at viewport390. Document scrollWidth390 was a false reassurance because overflow is clipped. Product catalog and detail drawer are different containers and remained usable in the prior read-only tests. Relevant rules are `components/issue-directory.css:1–3` (flex-column layout, primary min-width:0) and `recommendations.css:1` (shared horizontal auto margins). **Only the dimensions and applicable rules are proven; the exact causal sizing rule has not been isolated.** This local task performed no CSS-causality experiment and applied no width fix. `issue-directory.css` and `recommendations.css` remain unchanged. No claim is made that this issue is repaired.

Follow-up QA should verify this new card interaction on real desktop/mobile layouts, original route/scroll/focus, Enter/Space, left/right cards, reserve and permissioned management controls. Mobile sizing repair and any production replacement retain their separate authorization/review requirements. No shared coordination claim was accessed or released.
