# Candidate change history

## 20261112 product sorting and engagement, locally accepted

- 本程好物与好物推荐增加完整筛选集价格、评分、人气排序，价格按展示报价及同币种分组。
- V33 保存逐次商品点击，卡片右下显示火苗与热度，跨卡片/标签同步，大数保持精确整数并提供完整值提示。
- 复用 V32 用户评价，以悬停打星替换数字输入，保留改分、均分和冲突保护；关联调整不搬移其他商品的历史指标。
- 真实 PostgreSQL、并发、关联、边界文本与浏览器/像素/视觉验收通过，原本地服务恢复，生产未发布。
- [任务验收](reports/PRODUCT-ENGAGEMENT-20261112.md)。

## 20261111.4 production accepted

- 图片访问权限读取仅投影商品图集及推荐关联字段，保留 PUBLIC 范围、软删除拒绝、共享引用及完整 URL 精确比较，减少逐图完整实体读取。
- 9 项权限正反例、真实 PostgreSQL 投影及 HTTP 检查通过。正式后端 660 项中 636 通过、24 条件跳过，零失败，覆盖率门禁通过。复用 8bfb479 前端制品及 757 项前端测试，无数据库迁移。
- 生产首排两图禁缓存完成时间 4.96s 降至 2.64s，目录暖读中位数 1.86s 降至 1.04s；最终 601.7 秒、14 次健康采样通过且零重启，替换的旧 Core 已清理。实际截图和签名见 [最终证据](reports/evidence/image-read-20261111/README.md)。

## 20261111.3 compact cards, candidate accepted locally

- 好物推荐、本程好物及客户预览共用精简商品卡片。保留两行名称、同行等高、独立后续行、五颗灰星及用户均分，大字金额完整单行缩放。完整规格与优惠条件保留在详情。
- 来源参考价明确标注其窗口状态；只有优惠金额且缺少售价时显示价格待确认。期数目录入口归入标题行，服务活动独立通栏，避免遮挡或拉高商品卡片。
- 公开首屏 JavaScript gzip 体积减少 35.5%；批量读取推荐分类和报价，节点列表使用轻量可见性读取，无标记时省去重复目录请求。数据库保持 V32，无迁移、无新依赖。
- 前端 114 文件 757 项通过；后端 651 项中 627 通过、24 条件跳过、零失败，覆盖率门禁通过。生产速度与页面验收随发布回执补录。
- [任务及证据](reports/UNIFIED-PRODUCT-CARDS-20261111.md)。

## 20261108.2 — PRODUCTION ACCEPTED

- API reopened2026-11-08 17:01:55UTC. Web5095f376 plus exact reused782 core; three recommendation routes verified at1440/358px, stable second-page/Escape/focus and matching public assets. Seven consumer UI requirements, simpler card entry and friendly four-language maintenance are delivered.
- V27/full schema/all38 current table fingerprints and Costco82799v2/560874v4/28668v4 galleries preserved.15 unused image IDs and10 exact recoverable image archives cleaned; core/web each retain one running image.25 other recovery archives retained pending proof.
- [Actual production, data, tests, preserved matcher failure and capacity record](reports/CONSUMER-UI-20261108-MOBILE-PRODUCTION.md). Application CI and separately scoped publisher correction evidence are distinguished; prior failures remain.


## consumer-ui-20261108-mobile-r2 — DEVELOPER CORRECTION; NARROW QA PENDING

- Use each component manifest revision/digests consistently in publisher image, pending identity and readiness checks; 20 isolated checks pass. Current fc57 core and unknown identities remain rejected.
- Keep hidden directory geometry despite AntD reset; reserve public recommendation card photo geometry while containing natural images. Original624px observation mismatch is proven; genuine112/266px late-image failures are retained and repaired. Final three original return paths, including two-level Escape, have0px scroll/rectangle drift.
- [Exact correction and preserved evidence](reports/CONSUMER-UI-20261108-MOBILE-RECOVERY-R2.md). Independent delta QA, new CI/artifact/native nginx and production gates remain pending. No production operation.


## consumer-ui-20261108-mobile-r1 — DEVELOPER DELTA; INDEPENDENT QA PENDING

- Reproduced the real1159/761px mobile recommendation primary widths; constrain the column-flex primary to100% of its containing block. Home/current/selected issue fit at360/375/390px, desktop directory remains separate. Existing detail simplification is included.
- Add four-language maintenance503 presentation, manual retry and a standalone responsive503 page. Prepare an unbound maintenance/core-reuse adapter delta; acceptedf71 safety/lifecycle guards remain unchanged. No production switch or deletion.
- 79 unique affected tests pass (six rerun after a test-only type correction), final type/i18n pass. Six native keyboard return paths have0px scroll delta; right-card copy pointer and maintenance retry pass. Fullscreen wait errors are retained for independent replay; final built artifact, second-page/hover delta and native new nginx parse are not claimed passed. [Exact scope, root cause and QA continuation](reports/CONSUMER-UI-20261108-MOBILE-RECOVERY-R1.md).

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

## production-v27-resume-readiness-r2 — LOCAL TOOLING, NOT DEPLOYED (2026-11-07)

- The fc57d58 / 20261107.1 production attempt applied additive V27 but failed application readiness; old 20261106.5 / bec7b519 applications and original nginx/compose were restored. No old database was restored. Public acceptance remains unknown after a production-host HTTP 403; it was not retried or bypassed.
- Add a separate exact-V27 application resume operator. Pin Flyway checksum and column/default/constraint/index contracts; reject V26, partial/changed/newer schema and missing independent delta QA or current schema-27 backup. Do not replay the original migration action.
- Replace only core/frontend; keep unrelated AI/IM/auth/router writers running. Use bounded, identity-bound readiness/recovery with diagnostics, grounded in observed 102.6/107.6-second startups that exceeded the original 90-attempt wait. Preserve original configuration ownership guards and V27/customer writes.
- New offline tests execute the actual resume/recovery flow against synthetic host I/O. Application packages, hosted CI, original application QA and r1 code/failure history are reused unchanged; no build, upload, service replacement, migration, browser operation or activation occurred in this tooling revision.
- Requirements, diagnosis, design, delta tests and frozen input hashes: `frontend/test-results/recommendation-source-p1-20261107/PRODUCTION-V27-RESUME-HANDOFF.md` and `PRODUCTION-V27-RESUME-RECEIPT.json`. Independent resume QA and actual production/public verification remain pending.

## 20261107.1 / fc57d58 - DEPLOYED AND PUBLIC ACCEPTED (2026-11-08)

- Actual core/frontend application-only resume completed at 2026-11-08 05:05:55 UTC on the original host. Exact candidate and existing production package reused; no new application build, migration replay or database restore.
- Current PostgreSQL 18.6/V27 private consistent backup is verified and retained; all 38 existing business-table row counts/content fingerprints and the exact V27 contract match after activation. Ten protected service identities/images/revisions/health remain unchanged.
- Production core JAR and all 45 HTML/assets/SEO files plus frontend nginx config match the accepted package. Normal production-host public HTTPS returned 200; real anonymous desktop/mobile public browse, automatic pagination, facets, product/recommendation detail and reload/close passed. Actual loaded asset responses match accepted hashes; settled screenshots retained.
- Earlier release failure and this round's verification-harness failures are preserved. Corrected public RecommendationDetail.post.id assertion, bounded network wait and current DOM selectors; no application fix was made or retested as new independent QA. Original exact CI and independent application/r2 QA were reused.
- Original operator status remains application-only/public-pending by design; supplementary server receipt records actual public acceptance at 2026-11-08T05:16:03.639928+00:00, SHA256 c868c73fa3b785b865a5ca2a493fc4616cff7421ab1e29892efc1de59525c258.
- Requirements/design: docs/plans/PLAN-VISIBLE-BROWSE-20261107.md and docs/design/VISIBLE-BROWSE-V1.md. Actual timeline, data/backup/hash/UI proof, limitations and ownership return: frontend/test-results/recommendation-source-p1-20261107/PRODUCTION-RESUME-20261108-OUTCOME.json. New homepage/name/navigation/commerce/AI/image-source requests stay outside this batch.
