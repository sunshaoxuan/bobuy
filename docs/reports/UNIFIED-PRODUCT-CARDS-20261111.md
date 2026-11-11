# Product card unification

Goal: apply the existing product card presentation rules to every active product card surface, including public catalog, recommendations, merchant preview, recommendation editor and product records.

## 最终验收结果，2026-11-11

C2 样式收尾已完成：C1 分页截图暴露窄屏双滚动条，原状态视觉结论已撤销。评价 CSS 现锁定背景页滚动、限制弹窗内容高度，并让分页操作占满内容列。已用 390×844、360×800 的首屏及底部原图重新验收，分页按钮 44px，字形中心误差 0.219px，四边余量至少 15.28px；外层滚动尺寸与视口完全一致。21 条合成评价通过 20+1 分页全部呈现，加载完成后按钮消失。资料已从本地复制库清理，原示例仍为 2 人、均分 4.25。独立 Gemini 复核与主 Agent 最终视觉判断均为 PASS。见 [分页 API](evidence/unified-cards/review-pagination-api.json)、[字形](evidence/unified-cards/user-reviews-b2-final/pagination-glyph-metrics.json)、[外框滚动边界](evidence/unified-cards/user-reviews-b2-final/pagination-scroll-boundary.json)、[复核](evidence/unified-cards/user-reviews-b2-final/gemini-pagination-final.txt)。

本地产品功能、几何和视觉验收均为 PASS。候选位于 `codex/unified-product-cards-20261111`，基线为 `8ae465a`。本次完成代码、迁移、本地运行和逐页验收；生产发布不在本次范围。

最终规则：每行内卡片等高，各行按内容独立计算高度；商品名最多两行；货币符号与金额同行，常规金额保持 24–28px，过长金额按实际可用宽度自动缩小并完整保持单行；简化卡片实际售价区，保留单位和参考价说明。无公开均分时保留五颗灰星占位。用户提供的失败截图保存在 [原始纠正样例](evidence/unified-cards/user-correction-row-height.png)。先前全网格等高和价格换行结论均已撤销。

用户评分已替换商家手动评分。客户和采购员均可为公开商品提交 1 至 5 分、每档 0.5 分的评分及选填文字评价，每个用户对每个商品保留一条可修改记录。展示当前评分算术平均值；鼠标悬停、手机点击和键盘 Enter 可展开九档分布。示例两位用户分别为 4 和 4.5 分，均值为 4.25，卡片显示 4.3，两档各 1 人。作者身份来自登录态；公开列表只返回评分、正文、时间和评价记录 ID。

### 逐页矩阵

下列 PASS 均包含实际浏览器检查、对应截图、同行边界和金额完整性检查。桌面视口为 1440×900，手机为 390×844，最窄视口为 360×800。所有数据为本地合成验收数据。

| 页面或状态 | 桌面 | 手机 | 最窄视口 |
| --- | --- | --- | --- |
| 首页商品推荐 | [PASS](evidence/unified-cards/user-reviews-b2-final/home-desktop.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/home-mobile.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/home-narrow.jpg) |
| 本程好物 | [PASS](evidence/unified-cards/user-reviews-b2-final/catalog-desktop.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/catalog-mobile.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/catalog-narrow.jpg) |
| 标记商品及同页全部商品 | [PASS](evidence/unified-cards/user-reviews-b2-final/marked-1440.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/marked-390.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/marked-360.jpg) |
| 当前推荐 | [PASS](evidence/unified-cards/user-reviews-b2-final/recommendations-desktop.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/recommendations-mobile.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/recommendations-narrow.jpg) |
| 展开历史推荐 | [PASS](evidence/unified-cards/user-reviews-b2-final/history-desktop.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/history-mobile.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/history-narrow.jpg) |
| 当前单期 | [PASS](evidence/unified-cards/user-reviews-b2-final/issue-desktop.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/issue-mobile.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/issue-narrow.jpg) |
| 历史单期 | [PASS](evidence/unified-cards/user-reviews-b2-final/historical-issue-desktop.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/historical-issue-mobile.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/historical-issue-narrow.jpg) |
| 商品档案图片卡片 | [PASS](evidence/unified-cards/user-reviews-b2-final/records-desktop.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/records-mobile.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/records-narrow.jpg) |
| 紧凑管理商品卡片 | 桌面为既有表格，卡片项 N/A | [PASS](evidence/unified-cards/user-reviews-b2-final/stock-mobile.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/stock-narrow.jpg) |
| 推荐编辑商品卡片 | [PASS](evidence/unified-cards/user-reviews-b2-final/editor-desktop.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/editor-mobile.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/editor-narrow.jpg) |
| 客户效果预览 | [桌面 PASS](evidence/unified-cards/user-reviews-b2-final/preview-desktop.jpg)，[手机模式 PASS](evidence/unified-cards/user-reviews-b2-final/preview-desktop-phone-mode.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/preview-mobile.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/preview-360.jpg) |
| 已删除商品恢复清单 | [表格 PASS](evidence/unified-cards/user-reviews-b2-final/trash-desktop.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/trash-mobile.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/trash-narrow.jpg) |

恢复清单保留原有业务字段，其金额和评分项为 N/A。服务活动没有商品身份，其用户评分项为 N/A，已有服务报价采用同一单行金额组件。购物车、订单明细行及供应商卡片沿用各自业务布局。`ProductFeed`、`ClientHomeV2` 没有活动路由引用，已单独排除。

### 验证与版本绑定

功能：后端正式运行 644 项，622 项通过、22 项按条件跳过，失败和错误均为零，项目配置的 JaCoCo 门禁通过。另以真实 Java 17 Core 和 PostgreSQL 验证客户/采购员权限、九个分值、作者归属、匿名拒绝、版本冲突、并发创建/修改、均值和分布一致性、隐私字段及私有/删除商品隔离，见 [API 证据](evidence/unified-cards/user-review-api.json) 和 [后端门禁](evidence/unified-cards/backend-gate.log)。

迁移：V32 新建用户评价表，并保留旧商家评分表作审计记录，运行逻辑已移除旧评分读写。迁移前后 43 个既有表的数据和列结构指纹一致，新评价表初始为空，见 [迁移证据](evidence/unified-cards/user-review-migration.json)。PostgreSQL 直接约束拒绝越界值和非半分值，包括 1.04；产品行锁和评价版本检查保证并发只有一个写入成功。

前端：最终正式全量 113 个文件、750 项测试全部通过，失败为零，5 秒超时阈值保持原值，见 [正式结果](evidence/unified-cards/frontend-c1-suite.json) 和 [运行日志](evidence/unified-cards/frontend-c1-formal.log)。此前日期测试在完整运行触及超时，现将无关评分叶组件隔离，111 条资料和全部日期、草稿、身份及版本断言保留。评分本身另有组件及真实接口测试。34 项相关测试、TypeScript、1602 项 i18n 资源检查和最终构建均通过。

版本绑定：最终全量冻结 278 个前端输入；后续仅增加三个评价弹窗 CSS 规则，校验器按实际 LF 字节反向还原确认，全部 TypeScript 输入与正式运行完全一致。该 CSS 变更执行构建、真实浏览器、手机与桌面表单原尺寸字形复验；保留 [C1 编译记录](evidence/unified-cards/frontend-c1-build.json) 与 [C2 构建日志](evidence/unified-cards/frontend-c2-build.log)。509 个后端输入完全一致。见 [最终源码清单](evidence/unified-cards/user-reviews-b2-final/source-manifest.json)、[构建产物清单](evidence/unified-cards/user-reviews-b2-final/artifact-manifest.json) 和 [实际加载资源绑定](evidence/unified-cards/user-reviews-b2-final/loaded-asset-binding.json)。

几何：43 次页面状态观测覆盖 182 行和 187 次金额渲染。同行底边差不超过 1px；各行独立、无横向溢出；金额全部单行且文本完整。手机示例的长金额行高 406.86px，下一普通行高 370.72px，独立减少 36.14px；长金额缩为 17.3px，普通金额保留 24px。见 [机械核对结果](evidence/unified-cards/user-reviews-b2-final/mechanical-result.json) 和 [逐项几何数据](evidence/unified-cards/user-reviews-b2-final/page-geometry.json)。

原尺寸字形：使用 Chrome 原始 PNG，分别为 1440×900 与 390×844，等待 Modal 入场动画类移除后绑定控件坐标。八个评分表单控件和四个档案操作控件均通过原定预算：字形余量至少 3px，居中偏差不超过 min(2px, 字形高度的 10%)，手机主操作热区至少 44px，档案操作间距 6px，推荐编辑操作间距 8px。见 [评分字形](evidence/unified-cards/user-reviews-b2-final/native-glyph-metrics.json) 和 [档案字形](evidence/unified-cards/user-reviews-b2-final/native-record-glyph-metrics.json)。早期工具导出缩放和动画中的截图已退出最终判定。

浏览器：逐页批次记录 239 个响应，C1 记录 100 个，C2 最终记录 62 个，均成功且无加载失败，对应控制台 error/warn 均为零。见 [逐页网络](evidence/unified-cards/user-reviews-b2-final/browser-network.json)、[最终网络](evidence/unified-cards/user-reviews-b2-final/c2-browser-network.json) 和 [最终控制台](evidence/unified-cards/user-reviews-b2-final/c2-browser-console.json)。长时间验收期间本地登录令牌曾到期，已通过正常登录界面刷新会话，随后重新起始 C2 网络记录；该诊断阶段不计入成功网络区间。客户和采购员均通过真实界面保存并刷新读回；编辑保持评价人数不变。悬停、手机点击、键盘 Enter、Modal 关闭、预览设备切换、管理视图切换、历史展开和详情返回均已核对。

视觉：主 Agent 已检查整体运行图及原尺寸局部。Gemini Pro 图片请求不可用，当前目录中已实际验证的 `gemini-3.8-flash-high` 完成独立复核，七项核心视觉标准均通过，见 [独立复核原文](evidence/unified-cards/user-reviews-b2-final/gemini-final-review.txt)。其余疑点逐项处理：未知售价保持明确文字状态；原站半透明顶栏保持原有风格；导出裁边及动画中取图使用稳定后的原始 PNG 替换。最终判定由主 Agent 独立承担。

推荐核对的实拍：[桌面整体](evidence/unified-cards/user-reviews-b2-final/catalog-desktop-native.png)、[手机完整视口](evidence/unified-cards/user-reviews-b2-final/catalog-mobile-row-comparison-native.png)、[手机价格与行高局部](evidence/unified-cards/user-reviews-b2-final/catalog-mobile-price-detail-native.png)、[评价表单](evidence/unified-cards/user-reviews-b2-final/review-mobile-native.png)、[分布局部](evidence/unified-cards/user-reviews-b2-final/distribution-detail-native.png)、[档案](evidence/unified-cards/user-reviews-b2-final/records-mobile-native.png)、[紧凑管理](evidence/unified-cards/user-reviews-b2-final/stock-mobile-native.png)、[编辑](evidence/unified-cards/user-reviews-b2-final/editor-mobile-native.png)、[预览](evidence/unified-cards/user-reviews-b2-final/preview-mobile-native.png)。

### 本地环境与发布评估

沿用既有本地服务，单独复制数据库 `bobuy_cards_20261111`，没有修改原 V27 本地库或生产数据。Core 监听 `127.0.0.1:18081`，构建版前端监听 `127.0.0.1:5180`。使用已验证的 Node 20.19.0 和任务专属临时目录，修复测试资料签名、资源路径及缺失模拟数据问题。保留用于核对的本地构建与迁移前备份。

生产发布需要配套部署 V32、Core 新接口和前端资源，并按既有发布 operator 执行版本、备份、兼容性及恢复门禁。本次没有生产迁移、远端发布或生产订单写入。已有新写入后，恢复旧快照覆盖数据的方式不适用。

## 执行过程与已被后续纠正覆盖的中间记录

下列为过程记录，最终规则和验收以本页上方为准。旧的全网格等高、金额换行、商家手动评分及未完成结论均已由最终候选替换。

### B2 method and correction record

Follow-up C1 is bounded to completion of verification: the second full frontend run passed 749/750, with the same date-conflict case timing out. Source inspection shows its deliberate 111-item fixture also mounted unrelated new rating widgets against an API mock without the review API. Isolate that leaf rendering in the date suite, retaining all 111-item identity, version, permission and draft assertions and the same timeout. Rating rendering and I/O retain their dedicated tests and real-browser evidence. Also validate the conditional more-reviews state using 21 explicitly synthetic reviews in the copied local database, then remove that fixture. Enforce the same phone target budget if that state exposes a smaller control. No business logic, production data, gateway settings or migration changes are included.

Final exact-candidate frontend run: the earlier full report retained two timeout failures, and the final input adds the scoped optical CSS correction. Freeze all 278 current frontend inputs and run the complete 750-case suite once with two workers while browser acceptance is idle. Assertions and the 5000ms timeout policy stay unchanged. This is the bounded final rerun; backend inputs, migration, native HTTP and coverage evidence remain valid and are reused. Record the final report without overwriting the first run or targeted retest.

The user's screenshot correction supersedes the earlier global equal-height interpretation. Cards are equal height only within each grid row. A long title, unusual amount wrapping, or optional content in one row must not increase any other row's height. Use intrinsic auto grid rows with stretch alignment; retain the existing grid widths and gaps. Single-column management/trash rows size independently as well.

The actual selling-price presentation must be concise and designed: a small currency symbol and large amount share a baseline, with units as quiet supporting text. Remove the repeated actual-price label from compact cards. Keep reference-price labels so promotional reference offers remain distinguishable from actual selling prices. Keep the real currency available in accessible text/title, genuine zero versus unknown, existing artwork/corners and all user-review functionality.

Additional user correction: prices must never wrap, because splitting a number can be misleading. Normal amounts retain the large 24–28px size; when the full formatted price exceeds its actual available width, automatically reduce its font size enough to keep the entire number on one line. Apply this to actual and reference prices. Remove the former numeric-group break markup. Observe width changes and content changes with lifecycle cleanup; verify real font metrics at 1440px, 390px and 360px. Long-price acceptance now requires a single text baseline, the complete unchanged formatted number, no horizontal overflow and automatic shrink; a smaller extreme-price size is explicitly authorized by this correction.

Text-only DeepSeek `deepseek-flash` high advice supplied minimal currency/title and compact-label changes. Main agent accepts those semantics; its retained group-break markup is superseded by the subsequent user no-wrap requirement. Main agent owns the native ResizeObserver fitter, row sizing, tests, code and visual decisions. The fitter resets to the normal CSS size before measuring, shrinks only on overflow, schedules resize work on animation frames and disconnects/cancels on cleanup. No runtime legacy or environment fallback is introduced. The jsdom browser primitive is mocked only in test setup; browser font/resize verification remains mandatory.

B2 verification: 34 related assertions passed, TypeScript and i18n passed, and the built browser shows intrinsic independent row heights with no overflowing or multi-line monetary values. Formal frontend run completed 748/750 passing; two existing issue-date interaction cases hit the unchanged 5-second timeout under four-worker contention. The same complete six-case file reran with one worker and the same default timeout, passing all six in 5.75 seconds total. Reuse the other 744 assertions from the formal run; no assertions, waits or timeouts were weakened. Both JSON reports are retained. Backend inputs remain unchanged.

After the formal run, original pixels showed the centered record text-label glyph 1.10px below its target center against a 1.04px tolerance. The icon centering correction passed. Apply a 0.5px upward optical correction to text-label spans only, keeping icons and hit areas unchanged. The original crop and measured result are retained with the final replacement. This single-selector CSS change requires its build and record glyph/page recheck; the already passed JavaScript behavior evidence remains valid. Do not rerun unrelated backend or frontend behavior gates for this optical adjustment.

All prior card height and price visual acceptance is withdrawn. Reuse unchanged backend, migration, security, user-review persistence and browser interaction evidence. This bounded batch changes the shared money component, compact selling-price markup and applicable grid CSS, plus relevant render tests. Acceptance: at 1440px, 390px and 360px, same-row bottoms match; a deliberately tall maximum-price row does not enlarge a later ordinary row; symbol and first amount line share a baseline; no repeated actual-price label, no clipped/overflowing amount, and gray five-star placeholders remain. Start the real built candidate, inspect every affected active page, console/network, original screenshots and controls; repair and Gemini-review the new visible states. Freeze this batch before its combined tests/build. Production remains untouched.

User clarification: preserve the existing artwork and design style. Unify grid sizing, equal-height cards, two-line product names, emphasized large price numerals and rating presentation. Amounts are the primary price information; labels and units remain small. Ratings now follow the user review system below. This clarification applies to the whole existing task and its desktop/mobile page acceptance.

## User review system requirement correction

The user replaces the merchant-maintained score requirement with a real user review system. Every authenticated user, including customers and purchasing agents, can submit a product score from 1 to 5 in half-point increments and a text review. Product cards display the arithmetic mean of current user scores; hovering the stars shows counts for all nine possible scores. Mobile and keyboard interaction must expose the same distribution.

Implementation defaults: one current review per product and authenticated account, editable by its author; updates do not increase review count. Never trust a submitted author ID. Text is plain text, up to 2000 characters, optional with a score. No purchase prerequisite is inferred. Public summary/list access follows the existing product visibility and deletion policies. No reviews means null average, zero count and an explicit unrated state; zero is not a valid submission. Display the numeric mean rounded to one decimal, while retaining exact aggregate sum/count for computation. Half-star drawing is a visual approximation and must not change the mathematical mean. The distribution includes zero-count bins 1,1.5,2,2.5,3,3.5,4,4.5,5.

Migration: use the next version after V31, preserve the old merchant score data as audit-only legacy provenance, and do not convert it into user-authored reviews or aggregate inputs. Remove old merchant score editing, publicVisible flags and single-score runtime fallbacks after switching all consumers. New review uniqueness and range constraints are enforced in PostgreSQL. Product-row locking plus review version checking must serialize create/update and reject stale edits without partial writes. Summary reads must have consistent sum, count and distribution; avoid per-card review-list requests. Verify customer/agent parity, author ownership, anonymous mutation rejection, private/deleted product access, duplicate create, concurrent update, accurate averages and histograms, escaped text, no-review state and migration preservation.

This correction invalidates the prior merchant-rating acceptance and its review fixtures. Card layout evidence remains reusable only where rendering inputs are unchanged. The user review system has now been implemented and verified against a copied local PostgreSQL database. Final page acceptance is recorded below; historical continuation notes are not current acceptance claims.

Design advisory: current model-validating Claude request returned no available accounts; DeepSeek `deepseek-flash` high supplied text-only advice. Main review accepts exact numeric half-point constraints, a unique product/user key, short product-locked versioned writes and a single grouped query for coherent aggregate/histogram. Generic suggested table IDs, cascade deletion and runtime privilege changes are not adopted; repository product IDs are strings and existing retention/security rules govern them. This advisory is not implementation or test evidence.

Preserve the real price, publication state and existing operations. Establish user-authored reviews and aggregate ratings as specified above. Do not infer ratings or alter production data. Work against main `8ae465a` in this isolated checkout. Earlier merchant-score implementation notes below are historical and superseded for rating acceptance.

Use equal grid rows, a two-line title, prominent price amounts and small labels and units. At desktop and mobile widths inspect overall layout and every changed region, interactions, console and network; test long names, maximum price, optional fields and publication states. Record failures and missing evidence. Budgets: at least 3px glyph inset, center error at most min(2px, 10% of glyph height), 6px between adjacent action targets and at least 44px height for primary mobile actions.

Complete code, update the documented requirements, run focused checks and the applicable final gate, then review each page and evidence. No deployment is authorized by this task.

## Current acceptance

Current continuation scope: finish actual desktop/mobile acceptance for every active product card route, retain existing artwork, validate large prices, equal rows, two-line names and user review averages. All rating renderers use the new user review endpoints. Reuse the isolated database and local services. Capture final candidate, console/network, interactions and final crops; repair discovered defects before acceptance.

### Final candidate checks and responsive correction

Backend formal gate passed 644 tests (622 passed, 22 conditionally skipped), zero failures/errors, with generated JaCoCo data and all configured coverage checks passing. Real Java 17 Core and PostgreSQL HTTP/concurrency checks supplement conditional test skips. Frontend formal run passed 113 files and 749 tests on Node 20.19.0. TypeScript, 1602-key i18n validation and production build passed. Existing vendor bundle size warning remains.

At the final built-page review, narrow 360px cards and the nested mobile preview exposed inconsistent rating row heights when the unrated label wrapped. This invalidates narrow rating visual evidence only. The bounded correction stacks stars and their numeric/unrated label consistently in those narrow contexts, retaining font sizes, colors and artwork. Rebuild, focused component checks and fresh screenshots are required; backend inputs and frontend behavior tests are unchanged. Budget remains 44px minimum target height, 3px glyph inset, 6px target separation, and the original centering tolerance.

User correction during acceptance: unrated products always retain five gray stars as a permanent layout placeholder. This behavior already exists in the shared renderer and applies to public, editor, preview, gallery and compact cards, including products without a public review identity. No fabricated score of zero is shown. Keep this state in the final visual regression list.

Make the five empty stars explicitly muted gray (#b9b9b2) rather than relying on AntD's very faint default. Strengthen the existing unrated-state regression to require five empty stars. This changes presentation and the relevant assertion only; repeat the focused rating/price checks and final build, and capture fresh unrated states across the page inventory.

Desktop preview device switching revealed an additional real defect: the old device rule targeted the removed masonry class, so the new grid rendered a single column under the phone toggle. Update that rule to the active grid and apply two columns, 24px amounts, 14px titles/stars and the same fixed rating area in phone mode. This invalidates desktop phone-preview layout evidence. Scope is CSS only; reusing the 749-test behavior gate is valid because JavaScript, tests and dependencies are unchanged. Rebuild and repeat affected preview screenshots and geometry; retain other functional evidence.

Final control-budget inspection found zero padding on the existing transparent product-name buttons. Enforce the original 3px glyph safety budget on these buttons and source links, with 44px minimum title/source targets. This affects public/preview card geometry only. Capture the final public/preview screenshots after this CSS build; records/editor/stock controls retain their existing passed inputs.

Original-pixel action checks found a real record-card defect: the shared marker trigger's start alignment moved its tag icon to the left inside an expanded grid cell. The delete icon also exceeded the predeclared vertical tolerance by 0.09px in the normalized screenshot. Withdraw record action geometry/visual acceptance and center all four record actions with inline flex alignment. Rebuild and remeasure the same controls at the same phone viewport, then capture desktop/390px/360px records. Other renderer behavior and visual evidence is unchanged.

Incomplete. The preview now uses the public grid rules, the recommendation editor uses compact reference prices, and the product gallery has equal-height cards, two-line names and emphasized actual prices. Preview and editor records do not carry a public rating field; no rating was invented. The mobile stock management cards and deleted-product cards were subsequently identified and still require a deliberate scope and implementation review. The preview rating path also requires verification against the public projection.

On the isolated checkout, TypeScript `tsc --noEmit` passed. Five focused Vitest files passed 48 tests; the run emitted duplicate-key and React Router warnings. `git diff --check` passed. These tests do not establish geometry or visual acceptance. The development server started on 127.0.0.1:5179, but the browser showed an internal server error: requests to the local API proxy were refused because the backend was unavailable. Desktop and mobile page screenshots, glyph and control measurements, interactive browser checks, network and console acceptance, and Gemini screenshot review remain uncompleted. No deployment or commit.

The editor retained its offer notes after switching to compact price presentation; its four focused tests passed again after that adjustment. The local development server was stopped. Cleanup of the task's dependency junction was rejected by host policy before execution; the junction remains in this checkout and points to the existing release-test-gate dependencies. The incomplete candidate is intentionally uncommitted.

Continuation: mobile stock cards and trash cards now have two-line names; stock cards use square photos and prominent prices, actions retain 44px targets. Existing local services were restarted. Old backend schema V27 caused missing current APIs. A separate local bobuy_cards_20261111 database copied only existing synthetic fixtures, and the retained main Core JAR migrated it to V31. Candidate frontend now proxies 18081 via environment only. TypeScript and eight related archive/trash tests passed. Full frontend build result pending. Page acceptance remains in progress.

## Continuation evidence

Core JAR SHA256: `9262b19aabe2d4a40c1c370a654af7aff2fe78cbb73c5e1c81fbe675b9309374`. Local container `bobuy-cards-core-20261111` listens only on 127.0.0.1:18081 and uses the isolated database. Development frontend 127.0.0.1:5179 proxies it via process environment. Existing local V27 database was not migrated by the candidate. New SQL fixtures are limited to this copied database and explicitly synthetic; public fixture snapshots test rendering only and do not establish publication workflow correctness.

Build passed with 1589 i18n keys and the existing vendor size warning. Following image-error handling and mobile grid markup changes, TypeScript and 39 focused tests passed (archive 5, trash 3, navigation 3, history 28). The last button-group CSS change passed diff whitespace checks; a final build has not been rerun. Failed image handling uses a neutral placeholder rather than another product's picture.

Actual screenshots under `evidence/unified-cards`: catalog, issue and records at desktop 1440x900 and mobile 390x844, plus mobile stock, editor and preview, and desktop preview. These screenshots use synthetic data. The preview's three card heights measured 474.328125px at the mobile viewport. This is geometry evidence only. The final mobile record action group changed to two columns with 6px gaps and 44px minimum targets, and `records-390-final.jpg` supersedes the prior mobile record screenshot.

Gemini Pro image review failed upstream. Image-validated Gemini 3.8 Flash high reviewed `preview-mobile-cards.jpg`: it flagged bottom-bar clipping, price visibility, count and truncation. The count and two-line truncation are expected viewport behavior; the screenshot itself is insufficient to resolve the bottom-bar and full-price visibility concerns. They remain open. Main agent has inspected actual screenshots, including full-page mobile issue and record captures, but has not measured actual glyph ink bounds.

Overall acceptance remains incomplete. Missing: populated trash rendering and restore interaction, historical recommendation coverage, rating visibility states across every applicable renderer, full desktop editor and mobile preview device toggle coverage, final same-region crops and actual glyph/target measurements, clean final console/network acceptance, and post-CSS final candidate verification. No commit, push or deployment. Development frontend and isolated Core remain available for continuation. Dependency-junction cleanup remains previously blocked by host policy.

## Latest page acceptance continuation

Merchant product gallery, mobile stock cards, recommendation editor and private preview now render the existing merchant rating endpoint's explicitly public score. Hidden, missing and invalid values remain absent. A missing-product initial-state crash found by StoreNavigation test was fixed. Two meaningful component cases cover public visibility and late responses. The six-file regression batch passed 60 tests; after fixing duplicate sibling keys in writing/intake components, the affected recommendation and navigation suites passed 12 tests. Counts overlap and must not be added. Build passed before the final sibling-key and action-area CSS changes. Whitespace check passed after those changes.

Isolated fixture scripts now cover public 4.5 stars, hidden 3 stars, absent score, maximum reference price and integral JPY sale price, an expired issue, and a dedicated trash product. The temporary sale fixture originally lacked PRE_ORDER eligibility and used fractional JPY; corrected without changing production policy. All writes were to bobuy_cards_20261111. Actual mobile trash restore removed only card-trash-fixture from the trash list. The restored product remains in the copied database. Desktop trash is a table, with no card price/rating fields to invent.

Final-stage captures and DOM observations are in `evidence/unified-cards/final/`. Desktop 1440x900 and mobile 390x844 routes inspected: home, catalog, recommendation browse, issue, product records, recommendation editor, private preview, plus mobile stock cards. Every measured grid had equal outer card heights; title clamps were two, and sale amounts used 24px on mobile. See metrics.json for per-card measurements. This does not establish actual glyph ink or complete visual PASS. Price/rating fixtures changed after the first catalog-mobile.jpg, so that early image and its missing-price findings are superseded by later data, and need a final refreshed screenshot for delivery.

Historical recommendation expand loaded the dedicated expired product. Product detail open/close returned five visible list cards, retaining expanded history. Console revealed duplicate writing/intake sibling keys; prefixes fixed. A final clean console/network capture after this change remains required. Gemini 3.8 Flash reviewed an earlier mobile catalog capture and raised action baseline consistency and screenshot-overlay concerns. The action group now uses margin-top:auto and order11. Its title-height concern conflicts with measured reserved two-line title geometry; this disagreement is not a visual PASS. Final viewport crops, actual glyph bounds/target measurements, a final whole-page visual review including service cards, and the exact final candidate build remain open. No all-pages acceptance or release-readiness claim is made.
