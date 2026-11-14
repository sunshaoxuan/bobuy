# Issue #93 — 本程好物单列表与标记优先

## 用户授权范围

仅修改 `/products` 商品浏览查询、单列表 UI、四种现有语言文案，以及这些行为的直接前后端测试；不改变标记管理、商品身份、价格或订单数据。

## 本批修改与最小验证

- 后端浏览查询在分页前按 `markedFirst` 将标记商品分组，并保持所选排序在各组内的顺序：运行 `PublicProductBrowseServiceTest` 与 `PublicBrowseHttpContractTest`。
- 前端移除独立标记分区，新增默认开启且由 URL 保存的“标记商品优先”，并让排序由 URL 保存；旧 `productSection=marked` 详情链接继续由单列表打开：运行 `ProductMarkerCatalog.test.tsx`、`PublicProductCatalog.test.tsx` 与 `browseApi.test.ts`。
- 补齐四种 locale 的同一文案键：运行现有 i18n 静态检查。
- UI 变更：在目标页面做桌面截图验收（若本地应用栈可用）。
