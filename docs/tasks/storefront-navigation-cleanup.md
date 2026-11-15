# 前台导航清理实施记录

## PR #128 修正批次

- 延续 issue-126-storefront-nav-cleanup，统一期次名称为活动邮报（zh-TW 活動郵報、en-US Campaign Newsletter、ja-JP キャンペーン便り）。保留默认关闭的既有 flag 标识。
- 手机账户唯一导航入口放在底部快捷栏，连接 /account，提供登录、注册、资料和退出入口；桌面保留右上角图标，抽屉无账户重复项。
- 无进行中行程的首页目录复用 /products 的购买资格及添加逻辑，保留有进行中行程时的原购买行为。
- 同步 SEO 预渲染与断言，仅公开 / 和 /products。保留全部隐藏路由和后台代码。
- 本批路径限定四语资源、商城导航/CSS、首页购买逻辑、对应测试、SEO 脚本与本任务及 UI 标准。直接消费者为顾客商城及使用 rec.title 的商户后台。
- 验证冻结清单：导航、首页上下文/购买、偏好、隐藏路由相关 Vitest，check:seo、check:i18n、typecheck；预计 3 至 8 分钟。浏览器限账户入口、首页购买及 390/767/1280px；截图采用合成数据。必要项通过即停止，不提交、不发布、不创建新测试栈。
- 视觉预算：底栏三个等宽入口、热区至少 44px 高、间距 6px；文字四边至少 3px，中心误差不超过 min(2px, 字形高度 10%)；沿用既有颜色与圆角。

功能与美观同时验收，须符合 docs/ui-ux-guidelines.md：
- 功能按本 issue 需求逐条通过，不改变未授权行为。
- 视觉与所在页面现有 UI 一致：复用已有 token 与组件，禁止原生未样式化控件，新控件与相邻控件齐高、同圆角档、间距统一。
- 具备默认 / hover / focus-visible / 选中或激活态；触控目标 ≥ 44px；键盘可操作；有可见标签或 aria-label；对比度足够。
- 四语文案（含较长的 en-US / ja-JP）在窄屏不溢出、不重叠。
- PR 附 390px 与 1280px 的改动区域截图（含关键状态）。Playwright 可用则用现有脚本或一次性检查生成。
- 主移动断点 767px 及 390px 下布局正常换行，无横向溢出。
- 只运行与本次改动相关的最小测试；PR checks 通过。

## 授权范围与本批修改

- 仅调整顾客端导航、相关四语名称、隐藏路由的顾客行为、公开 SEO 清单与 UI/UX 标准；不删除行程或活动邮报路由、页面及后台推荐管理。
- `VITE_STOREFRONT_TRIPS_ENABLED=false`（未配置亦为 `false`）：隐藏可预订/已执行行程入口，直接 URL 保留节点参数并重定向到 `/products`。
- `VITE_STOREFRONT_DEALS_BULLETIN_ENABLED=false`（未配置亦为 `false`）：隐藏活动邮报入口；路由及后台工作流保留。
- 「本程好物」改为「好物推荐」（en-US `Product Picks`；ja-JP `おすすめ商品`）；原期次「好物推荐」改为「活动邮报」（en-US `Campaign Newsletter`；ja-JP `キャンペーン便り`）。
- 桌面和移动端默认均收起，分别使用 `bobbuy_store_navigation_desktop` / `bobbuy_store_navigation_mobile` 记忆。桌面默认收起是为了让以图片为主的目录从首次访问起使用全宽；展开使用覆盖层，避免推动内容和布局跳动。

## 最小验证集合

- 导航组件测试：四语下仅显示允许入口，隐藏行程、活动邮报和重复账户项，并核对更名。
- 路由测试：隐藏行程直接 URL 重定向至商品目录并保留节点范围。
- 偏好测试：移动/桌面默认收起、设备分桶及记忆相互独立。
- i18n 静态检查与 TypeScript 检查：覆盖四语键和组件类型。
- UI 验收依 `docs/ui-ux-guidelines.md` §8 / §9：390×844 与 1280×800 截图，并核对菜单按钮的计算宽高、最小宽高、圆角、边框、背景和阴影。

## 修正批次验证结果

- 验证重试依据：首次安装因子进程 EPERM 中断；使用现有缓存完成不执行安装脚本的依赖恢复后，重跑此前未执行的针对性 Vitest、i18n 与类型检查。SEO 使用同一测试文件的单进程执行补充核验；标准 check:seo 的进程限制仍单独报告。
- PASS：`npm run check:i18n`（1765 个资源键、引用及缺键负例）、`npm run typecheck`、`git diff --check`。
- PASS：`node --test --test-isolation=none scripts/home-seo.test.mjs`，3/3。原始 `npm run check:seo` 被 Node 子进程 `spawn EPERM` 阻断。
- 未完成：StoreNavigation.hiddenNode、StoreNavigation、StorefrontContext、StorefrontCommerce、storeNavigationPreference、storefrontRoute、AccountForm、AccountProfile 的 Vitest，在加载配置时被 esbuild `spawn EPERM` 阻断，没有执行测试用例。
- 未完成：Vite 同样因 esbuild `spawn EPERM` 无法启动，真实页面功能、控制台、网络、响应式、截图与 Gemini 视觉复核缺少运行证据。当前执行策略禁止沙箱外重跑，不能宣称 UI 验收通过。
- 新增回归覆盖四语活动邮报名、单个带节点参数的手机账户快捷入口、无进行中行程时首页与 /products 的购买资格及购物车写入，并拒绝无行程商户、无效售价和不具备推荐购买资格的商品。既有上下文测试改用当前底部导航选择器。
- 代码修正保留在工作树，未提交或发布；整体验收待受阻的功能与视觉检查完成。
