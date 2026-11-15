# 前台两级分类浏览候选证据

这是**隔离合成商品/API响应**的真实 Chromium 运行，不是生产数据验收。真实映射规则尚未填写，禁止发布。正式任务与缺项见 [任务文档](../../../tasks/storefront-two-level-20261116.md)。

## 有效截图
- 桌面：`1280-overview.png` / `1280-parent.png` / `1280-leaf.png`；1440同名组。
- 手机最终：`390-parent-final.png` / `390-leaf-final.png` / `390-drawer-settled.png`；360同名组。总览沿用 `390-overview.png` / `360-overview.png`。
- 原尺寸区域：上述 `*-navigation.png`；四语其他语言见 `360-parent-en-US-navigation.png`、`390-parent-ja-JP-navigation.png` 和对应完整图。
- 文字控件：`glyphs/*.png`，实际像素边界与预算见 `glyph-report.json`。29个文字导航控件通过，深色按钮圆角外的白底经主Agent看图确认后排除。

## 功能、网络与环境
- `browser-report.json`：四个视口基础流程、控件计算样式、请求及控制台。四视口无非预期控制台错误。
- `browser-extra-390.json` / `browser-extra-360.json`：额外焦点、滚动、错误恢复、分享/旧链接等；其中每视口3条500是刻意注入的失败，不是生产请求。
- `browser-locales-390.json` / `browser-locales-360.json`：修正初始化后真正切换语言的证据。
- `asset-readback.json`：最终相关源文件摘要、Vite实际服务资源回读摘要与环境边界。接受的合法shop-场景不受最后原始ID边界过滤影响。
- `test-summary.txt`：最小测试与执行结果；同输入PASS复用，不累计重复测试数。

早期 `*-drawer.png` 在进场动画前捕获，**不能作为抽屉视觉PASS**；`*-drawer-settled.png` 替代它。首轮四语初始化错误已在extra报告 invalidatedChecks 标明，最终语言结论只引用locales报告。保留早期运行截图供追溯，不混为最终证据。

复现：运行现有Vite后，在仓库根目录执行 `node frontend/scripts/verify-shopping-categories.mjs`。`SHOPPING_VIEWPORTS` 可限定必要视口；`SHOPPING_EXTRA_ONLY=1`、`SHOPPING_LOCALE_ONLY=1`、`SHOPPING_GLYPHS_ONLY=1` 分别只执行对应缺项。像素分析用 `python3 frontend/scripts/analyze-shopping-glyphs.py`，需Pillow。不要为了交接再次执行已有有效PASS。
