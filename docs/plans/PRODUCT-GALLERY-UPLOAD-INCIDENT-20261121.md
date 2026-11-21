# 商品主图上传生产回归

## 生产基线

生产版本 `7842054a5bd4295a00b0075861f1bd8102131cf2`。登录 Chrome 打开商品编辑器的「图片与来源」，顶部「添加图片」触发 0 次文件选择器；下方选择入口在填写来源并核对前禁用，条件满足后可触发。此次生产复现没有页面错误或业务写入。#192 到此生产版本之间没有 `ProductCatalogPanel.tsx` 差异，尚未定位首次引入的提交。

## 修复和发布

商品编辑器的「添加图片」在点击事件内打开一个现有原生文件选择器。文件本地预览先于审核；提交图片仍需有效 HTTPS 来源及现有核对确认。保存主档后才关联图片，作用域和版本校验仍由现有服务执行。

默认官方图片来源独立于各图片的来源。空图库也可保存并在重开时回读；第一张图片上传默认使用该来源。后续上传可以覆盖本次来源，已有图片继续保留逐图来源。V51 加两个可空字段，分别用于商品和恢复检查点。迁移可重执行，旧应用可忽略新增 SQL 列，回滚应用时保留这一迁移。

## 复现与上线验证

- 从仓库根目录启动 `npm --prefix frontend run dev -- --port 5198`，运行 `node frontend/scripts/verify-gallery-picker.mjs`，需可用的 Playwright WebKit。脚本验证 390 和 1280 CSS px、取消后再选、先预览、空图库保存后刷新、主图上传回读、有图后继续打开选择器及逐图来源保留。浏览器使用隔离 HTTP 夹具。
- `ProductCatalogIntegrationTest` 经真实 HTTP 控制器和隔离数据库验证来源持久化及首图实际上传保存，包括越权、版本、恢复和公开状态。
- 发布后使用获准的隔离商品验证从选择到主图回读，iPhone Safari／Chrome／Edge 需要实际设备验证系统选择器。生产待补图商品应继续由商家按授权流程操作。开发和验收均不批量改写现有商品。

候选证据：WebKit 每个宽度观察到四次原生选择器事件、两次经审核上传，刷新后来源回读成功，既有图片保留逐图来源。档案列表请求在刷新时有一次 WebKit 夹具中断，已在记录中单列。图库接口和交互没有其他错误。定向前端 20 项、后端 8 项通过。V51 在隔离 PostgreSQL 上连续运行两次，均得到两个可空来源列。

[390 截图](../reports/evidence/product-gallery-upload-20261121/gallery-390.png) · [1280 截图](../reports/evidence/product-gallery-upload-20261121/gallery-1280.png) · [WebKit 记录](../reports/evidence/product-gallery-upload-20261121/gallery-webkit.json)
