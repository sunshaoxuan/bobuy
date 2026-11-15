# Issue G：密码重置 UI（2026-11-15）

## 授权范围与本批修改

- 仅增加 storefront 与 merchant/admin 登录的忘记密码入口、请求通用成功态、重置表单、完成态及无效／过期／已用、限流和网络失败恢复态。
- 入口和页面只在 `VITE_ACCOUNT_PASSWORD_RESET_ENABLED=true` 时可见；生产未设置该构建开关且 `BOBBUY_ACCOUNT_PASSWORD_RESET_ENABLED=false` 保持关闭。
- token 仅从 URL fragment 读入组件内存，并在首次渲染 DOM 前用 `history.replaceState` 清理；不进入 DOM、存储、遥测或后续 URL。全站文档设置 `no-referrer`。
- 不修改发信、下单验证、Nginx，也不开始 C／D／E／H。

## 最小验证集合

| 修改 | 验证 |
|---|---|
| 四语请求／重置状态与双登录入口 | `PasswordRecovery.test.tsx`、`LoginPage.test.tsx`、i18n 检查 |
| token 清理、无存储、错误恢复、开关关闭 | `PasswordRecovery.test.tsx` |
| 类型与生产默认关闭 | frontend typecheck、production compose 静态断言 |
| UI | 390×844、1280×800 的请求成功、重置表单、无效链接、完成态截图与计算样式 |

## §8 标准验收条款

功能与美观同时验收，须符合 docs/ui-ux-guidelines.md：
- 功能按本 issue 需求逐条通过，不改变未授权行为。
- 视觉与所在页面现有 UI 一致：复用已有 token 与组件，禁止原生未样式化控件，新控件与相邻控件齐高、同圆角档、间距统一。
- 具备默认 / hover / focus-visible / 选中或激活态；触控目标 ≥ 44px；键盘可操作；有可见标签或 aria-label；对比度足够。
- 四语文案（含较长的 en-US / ja-JP）在窄屏不溢出、不重叠。
- PR 附 390px 与 1280px 的改动区域截图（含关键状态）。Playwright 可用则用现有脚本或一次性检查生成。
- 主移动断点 767px 及 390px 下布局正常换行，无横向溢出。
- 只运行与本次改动相关的最小测试；PR checks 通过。

## 078e042 review follow-up（2026-11-15）

- 授权修复仅限 StrictMode token 捕获、测试开关隔离、提交中错误态；生产开关继续关闭，不修改 Nginx，不开始 C／D／E／H。
- token 现在于 `main.tsx` 创建 React root 前捕获并清除，再作为只读 prop 传入恢复页面；实际测试用 `React.StrictMode` 包装恢复组件，防止 initializer 重放回归。
- 测试在每例渲染前显式开启功能，另有关闭开关的重定向用例。失败状态以 `undefined` 明确表示“无错误”，每次提交先清除，仅 catch 后显示。
- PASS：`npm run typecheck`；`node node_modules/vitest/vitest.mjs run src/pages/PasswordRecovery.test.tsx src/pages/LoginPage.test.tsx`（7 tests）；`npm run check:i18n`（1790 keys）；`git diff --check`。
- PASS：生产静态配置仍为 `compose.production.yml` 的 `BOBBUY_ACCOUNT_PASSWORD_RESET_ENABLED: 'false'`；未设置 `VITE_ACCOUNT_PASSWORD_RESET_ENABLED`，本批没有 Nginx diff。
- 双视口实拍当前环境受阻：Playwright 1217 本地无浏览器，`npx playwright install chromium` 对官方 CDN 的五次下载均返回 HTTP 403。因此没有伪造截图或计算样式，也不把 §9 标为 PASS；须在可下载／预装 Chromium 的 CI 或审阅环境运行同一批 390×844、1280×800 的请求成功、重置表单、过期／已用／无效链接合并状态与完成态验收。
