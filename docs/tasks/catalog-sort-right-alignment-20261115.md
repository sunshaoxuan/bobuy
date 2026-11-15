# 好物推荐排序控件组右对齐

## 范围与基线
用户授权在最新 main 上把「默认排序」和「标记商品优先」作为一组右对齐，保持功能、顺序与既有外观，通过正常 PR/CI/CD 发布并验收生产。基线：1924f204。独立干净克隆，无其他任务文件修改。

定位：`PublicProductCatalog.tsx` 的 `.catalog-sort-controls`；问题为自动左外边距在内部 `.product-sort` 上，未推动整个组。

## 本批修改与最小验证
- 仅调整 `frontend/src/public-catalog.css` 控件组：外层自动左边距，组内右对齐，覆盖内部 select 自动边距；保留现有换行、间距、颜色、圆角、事件与 DOM 顺序。
- `docs/ui-ux-guidelines.md` 记录控件组布局；本任务文档记录证据。
- 验证：现有 `ProductMarkerCatalog.test.tsx`；浏览器仅检查 `/products` 控件组，390×844、1280×800 和 767/375 窄屏，四语、选中/未选中、排序、键盘焦点、计算样式、console/network、运行资源哈希和截图。
- 自动 PR CI 承担既有 lint/typecheck/tests/build，不在本地重复同一集合；浏览器用 Vite 开发服务器和线上只读 API，不起 Docker 栈。
- Gemini 截图复核必须有真实调用证据；缺少可用入口或凭据时记为未通过，不绕过门禁合并发布。

## 标准验收条款
功能与美观同时验收，须符合 docs/ui-ux-guidelines.md：
- 功能按本 issue 需求逐条通过，不改变未授权行为。
- 视觉与所在页面现有 UI 一致：复用已有 token 与组件，禁止原生未样式化控件，新控件与相邻控件齐高、同圆角档、间距统一。
- 具备默认 / hover / focus-visible / 选中或激活态；触控目标 ≥ 44px；键盘可操作；有可见标签或 aria-label；对比度足够。
- 四语文案（含较长的 en-US / ja-JP）在窄屏不溢出、不重叠。
- PR 附 390px 与 1280px 的改动区域截图（含关键状态）。Playwright 可用则用现有脚本或一次性检查生成。
- 主移动断点 767px 及 390px 下布局正常换行，无横向溢出。
- 只运行与本次改动相关的最小测试；PR checks 通过。

## 状态
任务指导已在实现前建立。生产基线和验收结果待记录。

浏览器首次检查在生产资源哈希读取处中止：Playwright API request 直连 IPv6 ENETUNREACH，尚未执行候选验收。改为从已能加载生产页面的浏览器 fetch 资源，仅重跑缺失的浏览器验收。

候选首例等待数据超时：Vite 的 Node 代理未使用环境 HTTPS 代理，直连生产 API 失败；curl 经环境代理已实际返回成功 JSON。验收脚本改为仅 GET 请求经 curl 读取同一真实生产 API 并转发给候选浏览器，不改应用代码；其余候选用例尚未执行。

## 验证结果与交付状态
- PASS：现有 `ProductMarkerCatalog.test.tsx`，3 tests（排序、标记优先、URL 恢复）；未运行其他本地套件或构建。
- PASS：16 个浏览器用例，四语 × 1280/390/767/375；整组右边缘与标题容器右边缘一致，无页面横向溢出；保留顺序，375px 下排序拉满、按钮换行右对齐。
- PASS：控件计算高度均 44px、圆角 8px；边框、背景、阴影及宽度见 `../reports/evidence/catalog-sort-right-20261115/browser.json`。中文桌面右边缘 1248px，390px 右边缘 374px；下拉与按钮间距 8.8px。
- PASS：点击切换 aria-pressed、排序选择和 URL 更新；键盘 Tab 到按钮、focus-visible；console/pageerror 与 HTTP >=400 均为空。生产 GET API 经环境代理转发，未做生产写入。交互截图中的加载状态如实保留；最终默认状态另附 final-loaded 与 final-controls。
- 主代理目视检查：最终桌面与手机控件组均右对齐、同高、文字完整，未改页面其他布局。商品图占位不是本任务修改范围，也不作为商品图片验收。
- 生产只读基线：`https://bobuy.cc/products`，入口 JS `index-faS7fmCv.js` SHA256 `bc7e165bcf944ec65b75985bd85bc5b700432b611a5a12904dc3e79d48049f8c`；主 CSS `index-CVC2hMes.css` SHA256 `e0a4e755c7a2752b22cc7abe2047005dd0e2923346d59aea592b7af2b5ee6b99`。这是发布前版本，不能认定为本次候选生产验收。
- BLOCKED：当前工具未提供 Gemini 调用入口，环境无 Gemini CLI 或 GEMINI/GOOGLE 凭据；仓库旧证据引用的是其他机器上的 Windows 模型调用脚本。未调用或伪称通过 Gemini；用户要求的 Gemini 复核仍欠缺。保留 PR，未合并，不触发 CD，不绕过门禁。
- CI：提交 PR 后跟踪该次自动运行，待补最终链接与结果。CD 未触发，候选生产版本和发布后截图未取得。
- 保留任务证据和已安装前端依赖供继续工作；一次性脚本以证据目录中的副本为准。没有改动其他 PR 或并行任务。
