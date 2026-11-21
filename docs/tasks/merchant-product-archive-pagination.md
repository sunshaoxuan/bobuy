# 商品档案分页

基线为生产 43e34ad5866610934c3ed46f3d1a55d5c96b470f。变更限商家商品档案列表和直接相关操作。SQL 先按当前商家、未删除、搜索及稳定排序筛选，再取当前页。列表仅给浏览所需摘要，详情按 ID 获取。批量导出按原先的完整档案语义。旧移动接口保留。

验证范围为独立 PostgreSQL 上 500+ 合成商品、分页和权限测试、StockMaster 和导出相关定向测试，以及 390/1280 浏览器录制与同夹具基线对比。与 #194、#195、#191 独立审查。
## 8. 标准验收条款（每个相关 issue 必须附上）
```text
功能与美观同时验收，须符合 docs/ui-ux-guidelines.md：
- 功能按本 issue 需求逐条通过，不改变未授权行为。
- 视觉与所在页面现有 UI 一致：复用已有 token 与组件，禁止原生未样式化控件，新控件与相邻控件齐高、同圆角档、间距统一。
- 具备默认 / hover / focus-visible / 选中或激活态；触控目标 ≥ 44px；键盘可操作；有可见标签或 aria-label；对比度足够。
- 四语文案（含较长的 en-US / ja-JP）在窄屏不溢出、不重叠。
- PR 附 390px 与 1280px 的改动区域截图（含关键状态）。Playwright 可用则用现有脚本或一次性检查生成。
- 主移动断点 767px 及 390px 下布局正常换行，无横向溢出。
- 只运行与本次改动相关的最小测试；PR checks 通过。
```


浏览器对比依赖两个精确前端构建。共享依赖的开发服务器曾出现 React 预打包缓存冲突，开发模式也会产生 React StrictMode 重复请求。改用各自独立的生产构建和 Vite preview，以可比较方式统计首屏请求。

## 分支协调

- #194 以 `dddce4061a90a8f39152fad81eeeb48edab79b12` 做 Git 三方计算，通过。保留照片 UI 和 API，并让 `onConfirmed` 指向有界的 `refreshArchive`。
- #195 以 `8aa793d13bfd551a5415b8fe22006937ca76dfd5` 做三方计算，`ProductArchive.tsx`、`StockMaster.tsx`、`productRecords.css` 需要协调。保留 #195 的首屏标题、拍照入口和队列位置，并保留此分支的商家身份挂载键。其紧凑搜索输入绑定 `searchChanged`，图卡与管理区共用此分支的分页状态和详情按需加载，合并两组 CSS。
- #191 以 `a0ccd833dfdd5dd93c3779c0f3979fba2d4ce752` 的分支方向为准，三方计算检出 `api.ts`、`StockMaster.tsx`、`StockMaster.test.tsx`、`productRecords.css` 重叠。对应 PR 的购物车整批预览和启用由其独立 API 决定全集，不能传当前页的 ID。启用后刷新当前页，购物车开关的读值需从分页摘要补齐。完整导出由本分支独立查询商家所有在用 ID，仍执行既有 500 件上限。

## 云端隔离验收

同一隔离 PostgreSQL，测试商家 520 条在用商品、每项三条媒体、另一商家一条和本商家一条已删除记录。两个前端使用各自的生产构建，连接同一 Spring 测试实例。基线前端为指定生产 SHA，基线请求走原移动全量接口。响应大小为浏览器读取的未压缩 JSON 字节，API 请求数统计首张卡片标题可见时和其后 1 秒。每个视口为单样本。浏览器按下照片确认时使用合成回执，商品档案读取、深链接、权限和分页走真实隔离 API。

| CSS px | 版本 | 首请求条数 | JSON 字节 | 接口 TTFB / 总耗时 ms | API 请求数 首卡 / +1 s | 首卡可用 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 390 | baseline | 520 | 3,175,138 | 340 / 389 | 527 / 529 | 4436 |
| 390 | candidate | 24 | 5,486 | 70 / 100 | 7 / 7 | 578 |
| 1280 | baseline | 520 | 3,175,138 | 288 / 299 | 527 / 527 | 3490 |
| 1280 | candidate | 24 | 5,486 | 20 / 33 | 7 / 7 | 477 |

用户提供的生产 HTTPS 单样本为 515 条、1,735,951 字节、1,375 条媒体，TTFB 839 ms、总耗时 932 ms。生产该样本只有接口计时。云端测量来自 520 条合成夹具和本机 Chromium，无真实 iPhone 或生产候选计时。

Chromium 在 390、1280 验证图库与管理表共用第 2 页、后页货号检索、跨页深链接，并在合成照片确认回执后验证分页接口刷新第 2 页、旧全量接口调用数为零。两种视口在验证过程中无应用异常和 API 错误。分页按钮计算高度至少 44 px。[原始数字与计算样式](../reports/evidence/merchant-product-archive-pagination/measurements.json) · [加载文件摘要](../reports/evidence/merchant-product-archive-pagination/runtime-sha256.txt)

| 宽度 | 基线 | 候选图库 | 候选管理表 | 搜索后页 | 分页控件 |
| --- | --- | --- | --- | --- | --- |
| 390 | [截图](../reports/evidence/merchant-product-archive-pagination/baseline-390.png) | [截图](../reports/evidence/merchant-product-archive-pagination/candidate-390.png) | [截图](../reports/evidence/merchant-product-archive-pagination/candidate-management-390.png) | [截图](../reports/evidence/merchant-product-archive-pagination/candidate-search-390.png) | [特写](../reports/evidence/merchant-product-archive-pagination/candidate-pagination-390.png) |
| 1280 | [截图](../reports/evidence/merchant-product-archive-pagination/baseline-1280.png) | [截图](../reports/evidence/merchant-product-archive-pagination/candidate-1280.png) | [截图](../reports/evidence/merchant-product-archive-pagination/candidate-management-1280.png) | [截图](../reports/evidence/merchant-product-archive-pagination/candidate-search-1280.png) | [特写](../reports/evidence/merchant-product-archive-pagination/candidate-pagination-1280.png) |

定向单测验证慢请求作废、错误重试、现有深链接、草稿和详情编辑、完整导出上限。前端 38 项通过，四语校验和 TypeScript 通过。隔离 PostgreSQL 集成用例通过，其中验证姓名和货号检索、稳定次序、轻量字段、负页码、不同商家、客户、匿名与已删除记录。旧移动商品详情契约用例 2 项通过。

## 复现

1. 使用专用 PostgreSQL 容器 `postgres:18`，绑定 `127.0.0.1:55433`，数据库及账号 `archive`，密码仅用于夹具 `archive-local-only`。测试以 create-drop 运行，目标固定为此回环数据库。
2. 基线和候选前端分别执行 `vite build`，设置 `BOBBUY_API_PROXY_TARGET=http://127.0.0.1:18082` 并用 `vite preview` 分别监听 5178 和 5179。
3. 设置 `BOBBUY_ARCHIVE_ISOLATED_TEST=true BOBBUY_ARCHIVE_BROWSER=true ARCHIVE_EVIDENCE=/绝对路径`，使用 JDK 17 执行 `mvn -f backend/pom.xml -Dtest=MerchantProductArchiveIntegrationTest test`。浏览器默认使用 `/usr/bin/chromium`，可用 `ARCHIVE_CHROMIUM` 指定。测试进程生成合成会话并启动浏览器脚本。
4. 生产复验使用有权商家会话，对比首请求条数、JSON 字节、TTFB 和总耗时。记录手机首卡可用时间，核对照片观察确认后只刷新本页。生产数据不作为云端测试输入。
