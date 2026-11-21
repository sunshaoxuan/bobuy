# 商品档案现场照片试点验收

商品档案首屏先呈现品牌、标题、拍照、搜索和手工建档，再呈现照片待办，最后是商品浏览。队列初始显示三个计数和第一条待确认任务，展开后各项统一显示照片、货号或时间、状态和入口。确认页将身份、上次和本次现场价、单位、现场有货确认和可放大证据放到首屏。确认栏位于滚动区外。新品画面显示识别结果、待核字段及现有资料表单，商品与价格写入仍由商家确认。

## 实拍

Chromium 渲染实际应用路由，API 使用合成夹具，照片均为测试样本。下表的宽度单位为 CSS px，视口高度依次为 800、844、800。

| 宽 | 画面 | 截图 |
| --- | --- | --- |
| 360 | 商品档案 | [视口](workspace-360-archive.png) · [关键区域](workspace-360-archive-detail.png) |
| 360 | 拍照与保存 | [视口](workspace-360-capture.png) · [关键区域](workspace-360-capture-detail.png) |
| 360 | 队列 | [视口](workspace-360-queue.png) · [关键区域](workspace-360-queue-detail.png) |
| 360 | 已有商品确认 | [视口](workspace-360-review.png) · [关键区域](workspace-360-review-detail.png) |
| 360 | 新品确认 | [视口](workspace-360-new.png) · [关键区域](workspace-360-new-detail.png) |
| 360 | 回执 | [视口](workspace-360-receipt.png) · [关键区域](workspace-360-receipt-detail.png) |
| 390 | 商品档案 | [视口](workspace-390-archive.png) · [关键区域](workspace-390-archive-detail.png) |
| 390 | 拍照与保存 | [视口](workspace-390-capture.png) · [关键区域](workspace-390-capture-detail.png) |
| 390 | 队列 | [视口](workspace-390-queue.png) · [关键区域](workspace-390-queue-detail.png) |
| 390 | 已有商品确认 | [视口](workspace-390-review.png) · [关键区域](workspace-390-review-detail.png) |
| 390 | 新品确认 | [视口](workspace-390-new.png) · [关键区域](workspace-390-new-detail.png) |
| 390 | 回执 | [视口](workspace-390-receipt.png) · [关键区域](workspace-390-receipt-detail.png) |
| 1280 | 商品档案 | [视口](workspace-1280-archive.png) · [关键区域](workspace-1280-archive-detail.png) |
| 1280 | 拍照与保存 | [视口](workspace-1280-capture.png) · [关键区域](workspace-1280-capture-detail.png) |
| 1280 | 队列 | [视口](workspace-1280-queue.png) · [关键区域](workspace-1280-queue-detail.png) |
| 1280 | 已有商品确认 | [视口](workspace-1280-review.png) · [关键区域](workspace-1280-review-detail.png) |
| 1280 | 新品确认 | [视口](workspace-1280-new.png) · [关键区域](workspace-1280-new-detail.png) |
| 1280 | 回执 | [视口](workspace-1280-receipt.png) · [关键区域](workspace-1280-receipt-detail.png) |

[浏览器运行记录](workspace-browser.json) 含控件坐标、边框、背景、圆角、阴影、API 记录和 Console。三种宽度均完成两个连续提交、刷新还原、原任务重试、放大、下载与人工确认回执。390 px 四语检查无横向溢出，主要拍照、队列确认、放大及保存确认入口均至少 44 px 高。390 px 首条待办按钮始于视口 y≈335，确认按钮始于 y≈773，高 44 px。

修复分支的 [Chromium 记录](chromium-browser.json) 与 [WebKit 记录](webkit-browser.json) 在 390 与 1280 CSS px 验证连续提交、刷新、失败重试和真实浏览器下载事件。分享取消采用 Web Share 合成夹具。实机的系统相机、文件分享候选项、相册写入和 HEIC 系统行为待验证，操作步骤见 [手机验收](../../../plans/PRODUCT-PHOTO-INTAKE-20261120.md#手机验收)。修复分支的截图绑定首个候选的应用源码，后续提交只调整单测等待。

复现时从仓库根目录启动前端 Vite，再执行 `PHOTO_DESIGN=1 node frontend/scripts/photo-workspace-preview.mjs`。默认使用本机 Chromium，可用 `PHOTO_CHROMIUM` 指定。使用匹配 Playwright 版本且具备系统依赖的 WebKit 时，设 `PHOTO_ENGINE=webkit`。`PHOTO_PREVIEW` 指定输出目录。脚本拦截 API，无需接入生产或读写真实商品。

## 后续页面顺序

以下为源码走查，使用真实任务的跨页验收需作为单独设计范围。

1. **订单和订单录入。** 订单列表排在行程卡片和筛选之后，明细继续用横向滚动表格。订单录入的 420 px 聊天卡排在提取结果之前，移动端要先通过完整聊天区才能核对建议。先试把待处理订单与提取结果放到首屏。[订单](../../../../frontend/src/pages/Orders.tsx) · [订单录入](../../../../frontend/src/pages/OrderDesk.tsx)
2. **拣货与采购。** 拣货在行程选择和筛选之后使用按配送分组的横向滚动明细。优先试点让当前配送、数量和已拣选动作在移动端同屏。[拣货](../../../../frontend/src/pages/PickingMaster.tsx)
3. **工作台概览。** 四张统计卡之后跟两张可横向滚动的表格。待业务页的优先级稳定后，按未完成任务和直接入口重排概览。[工作台](../../../../frontend/src/pages/Dashboard.tsx)
