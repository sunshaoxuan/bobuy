# Issue E：storefront 结账邮箱验证门槛体验（2026-11-15）

## 授权范围与本批修改

- 仅在默认关闭的 `VITE_CHECKOUT_EMAIL_VERIFICATION_ENABLED` 开关后，为未验证 CUSTOMER 的结账区增加脱敏邮箱、发送/重发、验证码、冷却、错误恢复与修改邮箱入口；验证成功刷新权威身份并保留原购物车。
- 开关关闭时保留既有「未验证也可下单」提示及原有下单行为；生产不设置该前端开关，并完整保留四个既有生产 `false` 覆盖。
- 不实施 Issue C 或 H，不改 Nginx、后端路由、发信配置、密码重置或 abuse 配置，不写入密钥、密码、连接串或验证码明文。
- 本批审查修复仅将验证后的身份刷新绑定到发起时的 access-token 会话，并修复 React 18 StrictMode 重放 effect 后的 mounted 标志；不改功能开关或任何生产覆盖。

## 修改与最小验证集合

| 修改 | 最小验证 |
|---|---|
| 开关关闭的兼容路径与开关开启的门槛 | `StorefrontCommerce.test.tsx`：关闭时原提示/下单不变；开启时未验证不能下单，成功刷新身份后原购物车可继续 |
| 发送、重发冷却、验证及失败恢复 | `CheckoutEmailVerification.test.tsx`：四语、重复操作、离线、额度、过期、错误码映射与输入保留 |
| 响应式视觉和控件状态 | Playwright 在 390×844、1280×800 截取成功、失败、冷却状态，记录 §9 计算样式 |
| 生产覆盖不变 | 针对 `compose.production.yml` 与 `application-prod.properties` 的精确文本检查 |
| 身份刷新的会话绑定 | `CheckoutEmailVerification.test.tsx`：`/auth/me` 飞行中切换 access token 或组件卸载时，不持久化旧身份、不通知验证成功 |
| StrictMode effect 重放 | `CheckoutEmailVerification.test.tsx`：在 `StrictMode` 包裹下发送验证码后正常结束 busy，并显示成功与冷却反馈 |

## 共用 UI 条款（docs/ui-ux-guidelines.md §8 原文）

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

## §9 浏览器实拍与计算样式

浏览器实拍暂未完成：当前容器没有浏览器可执行文件，`npx playwright install chromium` 的下载端点返回 HTTP 403。未生成或伪造截图及计算样式；需在具备 Playwright Chromium 的 CI/审查环境中按 390×844 与 1280×800 补齐成功、失败与冷却状态后才满足本项验收。
