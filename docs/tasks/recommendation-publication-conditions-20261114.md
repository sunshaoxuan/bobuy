# 好物推荐发布缺项修复（2026-11-14）

## 授权范围与本批修改

- 发布接口返回稳定条件码、可展示说明与跳转目标；逐项覆盖现有 `publishItem` / `requireReady` 条件。
- 发布卡片逐条展示缺项并提供来源上下文或商品主档跳转；失败时保留核对勾选。
- 增加 #11（仅缺供应商标识）、#12（渠道、来源标识、URL 与指定四语字段）镜像测试及 UI 回归测试。
- 补充 UI/UX 规则。不得改变哈希、历史数据、期次来源审核、售价或 `DRAFTER_ONLY` 的发布门槛。

## 最小验证集合

- 后端：`RecommendationItemPublicationTest`，验证发布条件收集与现有成功路径。
- 前端：`RecommendationsItemPublication.test.tsx` 与 `recommendationPublicationApi.test.ts`，验证错误契约、逐项 UI、跳转和勾选保留。
- UI：仅发布缺项卡片，在 390×844、1280×800 核对 §8 / §9 要求与计算样式。

## §8 标准验收条款

功能与美观同时验收，须符合 `docs/ui-ux-guidelines.md`：功能逐条通过且不改变未授权行为；复用现有 token 与组件；交互态、键盘、标签、对比度和 ≥44px 触控目标完整；四语长文案不溢出；390px 与 1280px 实拍；767px / 390px 正常换行且无横向溢出；只运行相关最小测试。

## §9 计算样式与截图验收

使用浏览器自动化在 390×844 与 1280×800 实拍 #11、#12、主档待审核与成功状态；记录缺项操作控件的 width、height、min-width、min-height、border-radius、border-color / border-width、background-color、box-shadow，并确认窄屏可读、可点且无横向溢出。
