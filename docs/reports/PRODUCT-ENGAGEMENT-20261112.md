# 商品排序、热度及星级本地验收

日期：2026-11-12，Asia/Tokyo。候选位于 `codex/product-engagement-20261111`。结论：授权范围的本地功能、数据、几何及视觉验收通过。

## 交付行为
两个公开列表增加服务端价格、评分和人气排序。价格跟随有效卡片报价并按币种分组。重复详情点击逐次原子累计，卡片右下显示火苗热度，大数保留完整精确值供查看。评分采用现有用户评价平均值，以悬停/点击和键盘打星，保留账户唯一性及版本冲突保护。跨栏目、同页及跨标签卡片同步。推荐改绑保留旧商品的历史指标。

## 实际验证
- 前端全量 765/765；最后的长文本样式及提示 9 项相关复测通过，i18n 1621 个资源键及 TypeScript、Vite 构建通过。
- 后端全量 661 项，零失败、24 条件跳过；最终价格相关 33 项复测通过。保留的 Surefire 报告并集含后续新增用例，共662项、零失败、24跳过，见 [后端报告](evidence/product-engagement/backend-tests.json)。条件跳过不计为实际执行通过。覆盖率不是此次本地功能验收的结论。
- 原有本地 PostgreSQL 中创建独立 schema，先装载 V32 及合成数据，再迁 V33，逐旧表比对行与列指纹；重复执行迁移、120 并发、改分、关联重绑、私有拒绝、分页/报价/评分方向及版本失效、重启及 bigint 最大值全部通过。
- 真实构建预览 `http://127.0.0.1:4173` 连接同一测试后端。1440×1000、768×1024、320×800 功能视口及 1440/768/320×900 截图视口；全部为明确合成数据。检查浏览器交互、匿名状态、控制台、网络、重复与跨标签操作。
- 2000 字实际保存，2001 字接口拒绝；文本框原生长度限制、72px 三整行可见内框、滚动起止、可见滚动条及手机弹窗通过。几何测量将实际截图前景字形、SVG 路径和热区分开；结果见 pixels.json。
- 两个 Docker 镜像构建通过。实际运行 JAR SHA256：`f2bf99e238274ddee763abba0a775278d92c7d9644bdf5c59e2422cfeff47f31`。实际加载 18 个 JS/CSS 响应体逐一匹配构建文件。输入指纹：`65ea0dde1ea406140d2f5199cb20a130623684cb6316720d9119d6c462b6ffb9`。

## 证据
[数据库与恢复](evidence/product-engagement/runtime.json)、[浏览器](evidence/product-engagement/browser.json)、[所有方向与原尺寸截图](evidence/product-engagement/geometry.json)、[像素预算](evidence/product-engagement/pixels.json)、[输入及制品绑定](evidence/product-engagement/candidate-binding.json)、[前端全量](evidence/product-engagement/frontend-tests.json)、[独立视觉复核及主 Agent 判定](evidence/product-engagement/VISUAL-REVIEW.md)、[收尾清理](evidence/product-engagement/cleanup.json)。

## 恢复与发布边界
原本地 JAR SHA256 为 `91319e567762fb22d7f48d4c3a443017999b24b13136d74c1ea99c4ea6142c8e`，已精确恢复，原实际业务库和 bobuy/public 的行及列指纹均核对一致。保留恢复镜像 `bobuy/local-backend:restore-91319e56-20261112` 及 recovery.compose.json。测试只替换本地 backend，原 web 容器和其他服务保留；未创建另一个 Docker 测试栈。任务 schema 与过程文件在交付前清理，正式证据保留。

V33 是独立点击表，现有 V32 业务表结构/数据保留已实测，回滚程序时保留点击表即可继续保有新计数。此为本地结构兼容评估与本地恢复验证，未宣称完成生产回滚演练。生产尚未发布，未推送远端。正式发布仍按当时生产基线、备份、制品与项目门禁执行。
