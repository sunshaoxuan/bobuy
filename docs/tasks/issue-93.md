# Issue #93 — 本程好物单列表与标记优先

## 用户授权范围

仅修改 `/products` 商品浏览查询、单列表 UI、四种现有语言文案，以及这些行为的直接前后端测试；不改变标记管理、商品身份、价格或订单数据。

## 本批修改与最小验证

- 后端浏览查询在分页前按 `markedFirst` 将标记商品分组，并保持所选排序在各组内的顺序：运行 `PublicProductBrowseServiceTest` 与 `PublicBrowseHttpContractTest`。
- 前端移除独立标记分区，新增默认开启且由 URL 保存的“标记商品优先”，并让排序由 URL 保存；旧 `productSection=marked` 详情链接继续由单列表打开：运行 `ProductMarkerCatalog.test.tsx`、`PublicProductCatalog.test.tsx` 与 `browseApi.test.ts`。
- 补齐四种 locale 的同一文案键：运行现有 i18n 静态检查。
- UI 变更：在目标页面做桌面截图验收（若本地应用栈可用）。

## P2 review follow-up: sorting controls overflow

- Scope: allow `.catalog-sort-controls` to wrap when its children cannot fit. Preserve product/business logic, API, URL state, and desktop inline layout when space permits. Leave changes in the working tree; do not commit or push.
- Method: add `flex-wrap: wrap` to the control group only. The existing sort minimum width and checkbox label remain unchanged.
- Frozen change paths: `frontend/src/public-catalog.css` and this task record. Direct consumer: the `PublicProductCatalog` sorting header.
- Acceptance: controls fit at 390px and narrower mobile widths, and remain inline when desktop space permits. Existing controls and state transitions retain their behavior.
- Minimal verification: inspect the focused diff and run `git diff --check`; inspect available frontend test coverage and runtime. Budget: a few minutes, with no dependency installation, full build, full suite, or service stack startup for this CSS-only fix. Browser checks require an available frontend runtime; report missing evidence explicitly.
- Implementation: added only `flex-wrap:wrap` to the sorting container. Static review confirms no changes to component code, business logic, API, or URL state.
- Test scope: existing component tests use jsdom, which cannot verify flex layout. Inspected responsive E2E coverage targets other pages; this follow-up stays CSS-only without a new harness.
- Runtime limitation: this checkout has no `frontend/node_modules`; no listener was reported on the configured frontend ports 5173/4173. Browser functionality, console/network, mobile/desktop screenshots and Gemini visual review remain unverified. No overall visual PASS is claimed.
