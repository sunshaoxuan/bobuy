# 商品现场照片录入：云端隔离验收

2026-11-20（日本时间）。完整需求、命令、增量重跑原因及发布限制见[同一任务记录](../../../plans/PRODUCT-PHOTO-INTAKE-20261120.md)。这些是候选功能的隔离合成数据证据，不是生产验收，也不是AI识别成功证明。

- `browser.json`：真实 Chromium + Vite + Spring HTTP + PostgreSQL；文件选择、预览、取消、已有商品999JPY/有货保存及回读、刷新重开、私有新品创建。1280×800、390×844、360×844、767×844的full/modal/actions原尺寸PNG。早期语言循环被初始化脚本覆盖，相关语言结论作废、错误命名图片移除；以 browser-locales.json 为准。
- `browser-extra.json`：档案历史实际页面；早期语言数据同样作废。实际照片任务请求进入worker但AI桥缺失。
- `browser-ai.json`：最终可读AI缺配置提示，保留原图和重试；真实请求200，不能等同识别成功。`390-ai-unconfigured-*`。
- `browser-media.json`：来源图私有预览、来源链接、明确勾选许可、私有创建和图片保存。来源和查看trace为标明合成的测试夹具，不是外部来源检索成功回执。
- `browser-locales.json`：修正初始化后逐一断言HTML lang，保留真实四语标题、网络、控制台、几何。`390-review-{en-US,zh-CN,zh-TW,ja-JP}-*`是最新四语截图；最后仅调整文字光学位置与checkbox内距，旧业务截图保留对应功能证据。
- `glyph-button-*.png`/`glyph-analysis.json`：早期英语选择态字形预算。
- `glyph-{locale}-{action,check}-*.png`/`glyph-locales.json`：最新四语原始1x控件截图与像素测量。控件截图可能因分数坐标包含额外一行背景；方法及测量范围写在JSON中。未声称所有系统控件都完成逐字像素检测。
- `test-summaries.txt`：真实执行日志的结果行，包含已定位失败和后续针对性通过；不是一次全量绿色日志，未保留认证头。功能代码对应的有效结果复用，失败原因见任务记录。

网络证据不包含Authorization头。控制台有既有种子商品图片域名 cdn.bobbuy.example/images.costco-static.com 无法连通的资源错误及ReactRouter开发提示；照片相关API无错误、无pageerror。无真实经营商品写入。

浏览器使用 `/usr/bin/chromium`，未接入实体手机；相机 capture=environment 与独立文件选择入口已检查，原生后摄、iOS/Android设备能力仍待验收。无可用 Gemini/Claude/Sub2API 桥，视觉由主模型直接检查原图。真实AI、设备和生产A7由本地协调者接续，PR保持draft。
