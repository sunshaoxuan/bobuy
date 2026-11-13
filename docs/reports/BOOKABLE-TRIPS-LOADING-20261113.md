# 可预订行程持续加载调查与修复

## 目标、范围与方法
用户反馈可预订行程页面持续转圈。定位真实页面的请求、组件加载及状态生命周期，修复直接原因并完成针对性验证。既有未提交改动保持原样，必要实现基于当前 main 的隔离工作树。排除其他页面功能扩展、业务数据修改和全产品回归。

## 用户后续要求，第二批
用户提出连接失败时先显示没有行程，随后明确核心目标是解释为何频繁连接报错、重试持续失败，并解决连接根因。当前优先调查真实线上网络、网关、服务日志及重试链路，展示调整暂停实现。此前仅确认状态渲染缺陷，全部网络根因仍未确认。使用只读线上请求和日志关联获取端点、时间、状态码、耗时与异常，不做无依据重试或负载测试；必要最小修复、验证范围和发布边界待证据明确后冻结。不得把错误隐藏当作连接根因已解决。

### 根因证据、优先级与第二批冻结
用户进一步明确：先根因修复及有限重试恢复，重试全部失败后才显示无行程；禁止首个失败即显示空状态。线上 nginx 将访问日志写入容器内普通文件，Docker stdout 不含该访问记录。读取实际 access.log 后确认 2026-11-13 06:03:15 UTC（15:03:15 JST）两条 storefront/trips 与 auth/me 均 401；同秒 auth/refresh 为 200，次秒 auth/me 为 200，行程未在同一会话恢复流程重发。浏览器当前旧页面持续 spinner；真实刷新后三项请求全为 200，行程 TTFB 约 36ms/43ms。runtime-investigation.json 与 user-browser-reload.json 保存无凭据证据。不能将此前读取 Docker stdout 的零记录作为实际访问无错的证明。

源码证据：storeGet 的公开 GET 默认携带 access token，明确禁用 401 refresh；TokenAuthenticationFilter 在无效 bearer 时直接 401，即使目标路径 permitAll；Storefront 只按 shoppingContext 启动元数据，auth/me 刷新不重新读取行程，且 sessionIdentity 变化会清掉全局错误。故失效会话让本应匿名可读的公开数据失败，重试策略又不覆盖 401，最终落入持续 spinner。日志确认会话失效与刷新链，具体 JWT 失效子类型未记录，不能进一步断言过期或撤销。

局部修复由主 Agent 直接完成，边界冻结：api.ts 的公开 storefront GET 不附加登录 bearer，保护认证 API 与写入边界；Storefront.tsx 仅在现有有限重试已耗尽且错误可恢复时显示既有空状态，pending 继续加载，内部 tripsReady 仍 false，不允许假定预订资格；相应 readRecovery 与 StorefrontContext 用例。维护状态、业务拒绝和受保护请求沿用现有处理。原始本地候选已合并当前 origin/main 4dc36d1，保留线上已发布品牌调整，无额外产品功能。

最小验证集合冻结为 readRecovery、api、browseApi、publicCatalogApi、StorefrontContext、StorefrontCommerce 六文件，一次合并执行，预计 1 分钟；build 一次，预计 1 分钟。源码/状态与品牌依赖变化使上一批构建和页面状态截图失效；新增测试验证失效 bearer 的公开读取隔离、第一次失败保持 pending、有限重试恢复、耗尽才空状态、网络恢复后重新读取与无写请求。真实浏览器桌面及 360px 使用构建产物和真实公开 API，局部故障仅在浏览器内注入，记录请求次数、Console、响应式及最终截图，预计 5 分钟。无新增控件或 CSS，空状态沿用当前设计。正式 CI 跟踪精确候选原运行，发布评估只涉及 frontend 兼容替换与保留旧镜像回退，不改数据库或后端认证策略。通过即交付，不全产品回归。

### 第二批验收与发布评估
六文件 67 项全部通过，build 的 i18n、TypeScript、Vite、prerender 全通过，见 tests-phase2.log 与 build-phase2.log。browser-phase2.json 记录：失效会话 fixture 在本地存储时，公开 GET 全部不含 Authorization；前两次 ConnectionFailed 期间 spinner=1、无空状态、无错误提示，第三次正常读取真实 API 成功；另一组恰好三次失败后 spinner=0、空状态可见且无错误，解除局部注入后以 online 事件夹具恢复一次 GET 200。网络均为 GET，无业务写请求，Console 捕获为空。手机 360×800 无横向溢出；1280×720 与手机最终截图及原尺寸局部已保存并查看。夹具存储与 Fetch 拦截已清除，临时视口已恢复。Chrome Fetch 控制要求显式 resourceType=Fetch，清除拦截采用 patterns=[]，未改变目标源码或因此重跑产品测试。

Gemini 3.8 Flash 的新状态复核没有发现裁切、遮挡或层级问题，提醒静态空状态无法区分“真空”与“读取耗尽”、无重试按钮及遥测证据。展示行为是用户明确要求；后台失败分类、online/focus 恢复和原有结构化网络证据保留，未新增遥测平台或控件。主 Agent 仅判本批状态视觉通过，不宣称全站字形几何验证。

当前生产 frontend=20261113.unified-brand.1、revision34b9952c65aa6d88ed14a4382b769fe3551fc722、image sha256:5ac33f0901f33d622a2d559e4a8a05b78a2b5474c7399be7bce32435f36ee9f3；Core=20261113.offer-source-drawer.1、revision9f948b1bd98aca3019b5c7ee98e63c59e9aa1582、image sha256:9f507f7dbb910193ac50ee10dcf6ecbecd04303dc96a9ad71187ddc6c2aa832f。已核实既有 release library 摘要5fddec223ef6f1d38402c8a11c1f99877ffc93f9d7d4b5afeb1271752c5610ac与路由摘要b099bf59589e5b297699324d265209a112ad5b3865c51d1f174c12a427e6b391。计划版本20261113.public-trip-recovery.1，复用已验证的 frontend-only operator，仅替换前端并保留原镜像与 compose.before.yml；不迁移、不停写、不创建全量快照。源码候选冻结后仅跟踪原 CI 和发布所需的真实版本/页面验收，不追加优化与无关检查。

## 完成标准与检查预算
1. 记录真实线上页面、网络和 Console 证据，区分现象、根因与未确认因素。
2. 冻结实际修改文件及直接消费者后执行最小测试集合，预计 1 至 3 分钟。
3. 若修改前端，构建一次并在真实浏览器验证可预订行程的正常、失败和重新进入状态，桌面及最窄支持视口，预计 5 至 10 分钟。复用适用证据，不重复全量。
4. 如产生可见布局变化，实施前补充视觉预算，使用最终运行截图及 Gemini 复核。加载状态修复沿用现有控件样式。
5. 明确本地修复和实际生产状态，必要发布按项目现有门禁与兼容回退执行。验收满足后停止扩展检查。

## 初始证据
截图为导航选中可预订行程、主体仅显示加载动画。原工作区有大量其他任务改动，本地代码与 origin/main 不一致。当前 origin/main 为 63367da。已读取 bobuy-rapid-production 及 engineering-investigation-evidence 技能。

## 已确认原因与候选冻结
生产页面加载 index-BE7QJrP-.js，直接访问以及账户到行程切换可正常显示空状态。浏览器内仅阻断 /api/storefront/trips 后，读取重试耗尽显示错误且 spinner 持续；关闭错误提示后仅保留 spinner，复现截图同类现象。移除阻断并刷新后恢复。该实验确认错误状态渲染缺陷，不能确认用户历史请求失败的具体网络原因。

局部修改由主 Agent 直接实施：Storefront.tsx 将 tripsLoading 与 tripsReady 分开，finally 只结束当前 generation 的 loading；请求失败保留重试提示且不能关闭成空白页面；失败时不显示 spinner 或无行程空状态。StorefrontContext.test.tsx 增加失败、手动重试和 pending/success 状态用例。未调整 API、重试策略、布局、CSS、权限、业务数据。最小验证集合冻结为 StorefrontContext 与 StorefrontCommerce 两文件，随后 build 一次；只读真实生产接口、本地浏览器故障注入，桌面及 360px 检查、截图、Console 和网络。沿用 Alert/Button 既有尺寸，提示文案与热区保持现有样式，错误状态仅移除 close 按钮及 spinner，功能状态视觉复核不改布局预算。预计总计 5 至 10 分钟，无全产品回归。用户当前请求为故障调查，生产发布未执行。

## 最终验收与交付边界

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| 失败后停止 spinner，pending 保留 spinner，手动重试恢复 | PASS | StorefrontContext 22 项及 browser.json |
| 直接相关下单与身份边界 | PASS | StorefrontCommerce 13 项；合并一次 Vitest，35/35 |
| i18n、TypeScript、构建及首页预渲染 | PASS | checks.json；主资源 index-DktI1_4D.js 摘要已保存 |
| 桌面 1280×720 与手机 360×800 | PASS，限定本批状态变化 | desktop-failure.jpg、mobile-failure.jpg、desktop-recovered.jpg、mobile-success.jpg |
| Console、网络及只读边界 | PASS | browser.json；浏览器内阻断 trips 路径同时匹配 includeCurrent 查询，重试后两个 GET 均 200，无业务写请求，Console 捕获为空 |
| 外部视觉意见及主 Agent 判断 | 已完成 | visual-review.md；Gemini Flash 已验证图片可用，Pro 两次上游失败 |
| 历史原始请求失败原因 | 未确认 | 用户原始网络记录缺失，不能将注入故障当作历史根因 |
| 生产上线 | 未执行 | 本次仅调查和本地修复，未推送、未创建 PR、未操作生产容器 |

预览首次启动发生在 build 完成前，因 dist 不存在退出，尚无浏览器证据产生；build 成功后启动同一候选预览，未重跑测试或构建。实际验证结束后已停止预览，删除本任务 dist，保留源候选、正式截图、摘要及检查记录；共享依赖及其 junction 保留。清理见 cleanup.json 和 cleanup-manifest.json。纯文档收尾只检查引用及 diff，不重复功能验证。

最终结论：持续转圈的错误状态渲染问题已复现且本地修复验收通过。用户当前线上版本仍需部署该候选才能获得修复，未宣称线上已修复。
