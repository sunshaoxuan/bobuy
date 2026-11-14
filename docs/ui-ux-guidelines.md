# Bobuy UI/UX 开发标准

面向所有会改到用户界面的任务。功能和美观都是验收项，缺一不可。本标准以 **2026-11-14 已上线站点（`main`，含 #94）的真实实现** 为准，token 与数值均从当前前端代码提取。历史规划若与现行代码冲突，以本标准与现行 CSS 为准。

相关文档：`docs/guides/GUIDE-08-i18n规范.md`、`docs/design/STOREFRONT-PINTEREST.md`。

## 1. 原则
1. **先复用，再新做。** 优先使用页面已有控件、class 与 token。
2. **禁止原生未样式化控件。** checkbox、radio、select、button 必须有完整视觉状态。
3. **与邻居齐高对齐。** 同组控件的高度、圆角和间距必须一致。
4. 公开商城 `.storefront` 与工作台 `.app-shell` / `.merchant-shell` 是两套表面，不得混用；商城不可使用后台 Ant Design `Switch`。
5. 当前没有暗色模式，不得擅自增加。
6. 新动效须尊重 `prefers-reduced-motion`。

## 2. 已落地 token
### 2.1 工作台全局
`--zen-bg: #faf9f6`；`--zen-ink: #2d2926`；`--zen-muted: rgba(45, 41, 38, 0.58)`；`--zen-line: 0.5px solid rgba(0, 0, 0, 0.08)`；空间为 `0.5rem / 1rem / 1.5rem`；`--blur-glass: 10px`；玻璃不透明度为 `0.9 / 0.82 / 0.72`；投影为 `none`。字体为 `Inter`, `Segoe UI`, system-ui, sans-serif。

### 2.2 公开商城
强调色 `#d93630`，hover `#ce3028`；背景 `#fff`；主文字 `#232323 / #191919 / #242424 / #282828`；辅助文字 `#626262 / #666 / #777 / #555`；浅底 `#f3f3f3 / #f5f5f5 / #f0f0ed / #f7f7f7`；选中深底 `#242424 / #252525 / #171717`；边框 `#d9d9d9 / #ededed / #eee / #00000010`。默认字号 **15px**，行高 **1.65**。

### 2.3 圆角家族
已有 **6px**、**8px**、**16–20px**、**24px**、**26–28px / 999px**。同组使用同档。本程好物排序和分类胶囊均为 **8px**；公开列表的状态 / 提示消息使用 **26–28px / 999px** 大圆角档，见 §3.7，不得套用 **6px** 按钮档。

### 2.4 断点与验收视口
主移动断点 **`max-width: 767px`**；另有 `375px`、`650px`、`1023px`、`1099px`、`1199px`。至少在 **390×844** 与 **1280×800**（或 1280×900）截图自检。

## 3. 控件规范
所有可点击控件最小高度 / 触控目标 **≥ 44px**。

### 3.1 按钮
商城主按钮 `#d93630`，hover `#ce3028`；后台主按钮 `#252529`，hover `#45454c`。砖红色不得用于筛选芯片。

全局 ≥44px 规则继续适用于公开商城、普通工作台按钮以及手机 / 触控界面。唯一例外是工作台密集表或密集工具条中的 **icon-only 圆形按钮**：桌面视觉直径可为 **28–32px**，命中区不得小于视觉尺寸，建议用隐形热区扩展到 **36–40px**。该例外必须同时满足圆形、Tooltip + `aria-label`、键盘可达及完整的默认 / 精细指针 hover / `:focus-visible` / active / disabled 状态；复用 `--zen-ink`、`--zen-muted`、`--zen-line`、`--zen-bg`，不得引入新主色。实现与验收细则见 §10。

### 3.2 搜索
`.browse-search` 最小高度 48px、圆角约 28px、填充 `#f0f0ed`、无边框，不得套到短筛选控件。

### 3.3 选择器
`.product-sort` 高度 44px，最小宽 200px，边框 `1px solid #d9d9d9`，圆角 **8px**，白底，文字 `#282828`，字号 14px，内边距 `8px 30px 8px 12px`；焦点 `outline: 2px solid #795908; outline-offset: 2px`；≤375px 拉满。

### 3.4 分类胶囊 / 筛选芯片
容器 gap 8–9px；未选中 `#f3f3f3` / `#f5f6f5`、文字 `#303846`；选中 `#242424` / `#252525`、白字；内边距 `10px 16px` / `10px 18px`；最小高 44px；字号 14px、字重 500。本程好物页用 **8px** 圆角。

### 3.5 开关与布尔筛选
Ant Design `Switch` 只用于后台。公开商城布尔筛选使用 `button` + `aria-pressed`（或视觉隐藏 input + 已设计 label），不得使用浏览器默认 checkbox。

### 3.6 控件组 / 过滤栏（必须遵守）
使用 `display:flex; align-items:center; flex-wrap:wrap` 与已有 gap；同组齐高；窄屏换行且不撑出视口；未选中浅灰、选中深底白字；排序旁焦点优先用 `2px solid #795908`；hover 仅用于精细指针；禁用态仍保持 44px 命中区。

### 3.7 状态 / 提示消息（消息标签）
1. 列表底部的「加载更多」、加载中，以及将来若增加的列表结束提示，属于状态 / 提示消息，不是购买、提交等主操作按钮。
2. 必须使用 **26–28px 或 `999px`** 大圆角 pill / capsule 消息标签；禁止使用 **6px** 小圆角按钮样式。`.feed-loader button` 按本条实现，不得出现 Ant Design default button 的浅阴影、小圆角描边或其他按钮 chrome。公开商城已有 `.storefront .ant-btn { border-radius: 6px; padding: 7px 14px; }`；新样式选择器必须比它特异度更高（例如 `.storefront .feed-loader .ant-btn`），避免圆角和内边距被盖回按钮形态。
3. 标签水平居中，使用公开商城既有浅底（`#f3f3f3` / `#f5f5f5` / `#f7f7f7`）和辅助文字色（`#626262` / `#666` / `#555` / `#444`），边框应无或更轻，不得用砖红 `#d93630` 填充；沿用 `.feed-loader` 的 `padding: 24px 0` 或相近节奏。它须与购买 / 提交主按钮，以及 **8px**、选中深底白字的筛选芯片有明确视觉区分。
4. 自动加载列表可保留 `button`（或等价可达控件）作为键盘 / 点击的手动兜底，但命中区须 ≥44px，并完整提供 `:focus-visible`、hover（仅精细指针）、active、disabled、loading 状态；所有状态均保持大圆角消息标签形态，禁用或加载时不得退回默认灰按钮。焦点环应与公开商城既有焦点协调，不得伪装成主按钮描边。
5. 本条不强制改变分页行为：当前 `hasNext === false` 时卸载控件且不展示结束文案；将来若增加列表结束提示，也必须沿用本条视觉语言。
6. 新增或调整 UI 模式时，必须把实际落地做法写回本标准。

## 4. 状态、无障碍与动效
控件须有默认、hover、`:focus-visible`、active、disabled（如适用）；不得无替代地移除 outline。须有可见标签或 `aria-label`；布尔芯片用 `aria-pressed`；保证键盘可达、对比度足够、焦点不被裁切。

## 5. 文案与 i18n
用户可见文案走 `zh-CN`、`zh-TW`、`en-US`、`ja-JP` 四语资源。按最长译名设计：「标记商品优先」「標記商品優先」「Marked products first」「マーカー付き商品を優先」。不得溢出、重叠或随意截断。

## 6. 可复用实现（先找这些）
| 需求 | 复用 |
|---|---|
| 商品排序 | `ProductSort.tsx` 与 `.product-sort` |
| 分类筛选条 | `BrowseSupport` 的 `.rec-category-filters` |
| 本程好物 | `PublicProductCatalog.tsx`、`public-catalog.css` |
| 公开列表加载 / 状态提示 | `.feed-loader` + §3.7 消息标签样式；本程好物见 `PublicProductCatalog.tsx` / `public-catalog.css` |
| 后台开关 | Ant Design `Switch`（仅工作台） |
| 四语词条 | `frontend/src/locales/*.ts` |
| 系统更新 / 维护状态 | 边缘页 `infra/nginx/maintenance.html` 与应用内 `MaintenanceNotice` |

### 6.1 系统 / 错误 / 维护页
- 系统更新页属于公开商城表面，而非工作台：沿用 `#f7f8f4` 背景、`#c74036` 品牌标识、大圆角内容卡片，以及默认、hover、focus-visible、active 完整的 ≥44px 重试按钮。
- 边缘代理必须提供内联 CSS/JS 的自包含四语页面；frontend 或 Java 容器停止时仍可显示。应用已加载后则复用 `MaintenanceNotice`，两者都提供手动重试与 20 秒自动重试、保留原 URL，并尊重 reduced motion。
- HTML 文档使用 503、`Retry-After`、no-cache/no-store 与 noindex；API 使用 JSON 503，绝不返回维护 HTML。合法的鉴权、权限或 CSRF 401/403 不得被维护状态拦截。
- 维护页表达全页系统状态，不是 §3.7 所述列表底部状态/提示消息；恢复后应回到原页面，并保留本地购物车。
- 新增或调整此模式时，须把已经通过 390px、1280px 截图与计算样式（尤其 `.storefront .ant-btn` 覆盖）验收的实现写回本节。

## 7. Codex / 开发者自检清单
- [ ] 复用 token / class / 组件，无新主色、圆角体系或未样式化控件。
- [ ] 同组齐高、间距一致、圆角同档。
- [ ] 默认 / hover / focus-visible / active（及 disabled）完整。
- [ ] 触控目标 ≥44px，标签、键盘操作和对比度完整。
- [ ] 密集桌面 icon-only 例外仅按 §3.1 / §10 使用；手机仍保持 ≥44px。
- [ ] 四语文案在 390px 不溢出。
- [ ] 在 390px 和 1280px 截图；栈不可用时如实说明。
- [ ] 窄屏无横向滚动、重叠；reduced motion 未破坏；未扩大范围。

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

## 9. 计算样式与截图验收
1. UI 验收不得只做静态源码审查。必须使用 Playwright 或等价浏览器自动化，在 **390×844** 与 **1280×800** 视口实拍改动区域，并核对目标控件的计算样式；至少记录 `border-radius`、`background-color`、`box-shadow`、`min-height` 与实际高度。
2. 验收以浏览器计算结果为准：即使源码声明了 `border-radius: 999px`，只要计算值不符合设计要求，也必须判定为失败。
3. 公开商城的 `.storefront .ant-btn` 会把圆角和内边距覆盖回 **6px** 按钮形态。为 `.ant-btn` 或 `.feed-loader .ant-btn` 增加样式时，选择器特异度必须高于它（例如 `.storefront .feed-loader .ant-btn`），并同时检查背景、边框和阴影未恢复为默认按钮 chrome。
4. 新增或调整 UI 模式时，必须将已经落地并通过上述实拍与计算样式验收的做法写回本标准。

## 10. 紧凑 / 密集表
1. 工作台紧凑表以约两行文字为密度基准；`/admin/products` 的 `.stock-compact-table` 数据行计算高度目标为 **56–72px**（当前选择器使用 64px），垂直居中且不得因操作换行而增高。
2. 每行使用 `.stock-compact-thumb` 的 **40–48px** 小方图（当前 44px、8px 工作台圆角）；无图或加载失败必须显示占位图，并提供有意义的 `alt`。不得把正常图片卡片的大图样式带入密集表。
3. 文本列最多两行省略；溢出内容须能通过 hover Tooltip / `title` 与键盘 focus 查看全文。名称应获得主要宽度，SKU、可读类目、价格和状态为次要宽度；已有类目数据时不得仅显示内部 ID。
4. 操作列使用 `.stock-compact-actions`：圆形 icon-only 按钮簇、统一尺寸和间距、`flex-wrap: nowrap`，并尽量固定在右侧。桌面 `.stock-compact-action` 当前视觉 / 按钮尺寸为 **32×32px**；手机为 **44×44px**。每个按钮必须符合 §3.1 的 Tooltip、`aria-label` 和完整交互态要求，删除操作保留危险色。
5. 桌面不得以过大的固定 `scroll.x` 将操作藏到视窗外；列宽应按真实内容重新分配，更窄桌面可隐藏低优先级列，同时保持右侧操作可见。手机（≤767px）应改为“小图 + 约两行信息 + 一行圆图标”，不得退化为大比例图片卡片或产生横向溢出。
6. 验收至少覆盖 **1280×800、1024×800、390×844**。依 §9 实拍紧凑模式和未改动的正常图片卡片模式，并核对数据行实际高度、按钮 `border-radius` / `width` / `height`、背景、`box-shadow`，以及缩略图占位和操作列可见性；源码声明值不能替代计算样式与截图证据。
