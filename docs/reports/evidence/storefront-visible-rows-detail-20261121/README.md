# 可视行与详情性能：详情候选证据

基线 main `d5d608d1` / 前端 `index-DoiMe8lM.js`。本目录先交付详情读路径和多图调度，可视行加载继续独立 PR；此候选没有改列表请求量或挂载量。未合并、未部署、未操作生产数据。

## 可重放入口和命令
- 同一隔离 Spring `127.0.0.1:18080`、PostgreSQL 18.6，数据库 `manual_create_synthetic`、商家1000，463件合成商品；原有实例及依赖复用。
- `node docs/reports/evidence/storefront-visible-rows-detail-20261121/serve.mjs`：5186基线、5187候选。候选入口 `/products?node=1000&category=shop-progressive-leaf-1&product=progressive-item-1-1`。
- `fixture.sql` 只允许该合成库：给既有合成商品建立四图，复用已有PNG字节，每图68,608B/192×192；保留原gallery于任务备份表。没有真实商品摄影、生产SKU或素材写入。恢复合成gallery可按备份表id恢复media_gallery，新增合成图片无生产影响。
- `node .../benchmark.mjs baseline 5186` / `node .../benchmark.mjs candidate 5187`；每版本390×844和1440×900，正常/慢网各3次独立浏览器上下文。慢网CDP latency100ms、download200KiB/s、upload750Kbps，无CPU限速。点击热度POST被拦截返回固定0；其余接口及图片真实。
- 点击前清浏览器缓存，详情首图不借用列表缓存。`card/image`从导航起算，`shell/text/detailImage`从捕获真实点击起算；text是首个rAF观察到正文可用，不宣称精确光栅化完成。截图/边界检查确认正文在视口内；图片需complete+naturalWidth且可见。原始请求、headers timing、下载字节、错误保存在benchmark JSON。
- `python .../sql-timing.py baseline|candidate`：隔离PG启用SQL duration日志，仅导出表名/阶段/时长，不导出绑定参数。parse/bind/execute分别记录，不能将协议阶段总数称为SQL查询数。候选重启原Spring后预热排除启动请求；冷缓存指浏览器，不指DB/JVM。
- `node .../media-edges.mjs`：真实请求的首图阻塞、提前选择、首图404、相册、快关/切换、360窄屏；读取已有PASS并只执行缺项。重新完整验收应另选输出文件，避免把不同源码的PASS混用。

## 中位数（毫秒，每格3次）

| 视口/网络 | 壳 基线→候选 | 正文 基线→候选 | 详情TTFB 基线→候选 | 冷首图 基线→候选 |
|---|---:|---:|---:|---:|
|390 正常|78.8→88.6|263.4→318.1|140.2→129.5|294.5→331.5|
|390 慢网|83.5→101.4|292.4→262.1|122.2→105.4|2303.8→1322.4|
|1440 正常|68.3→76.2|309.3→318.2|137.1→77.0|344.5→330.9|
|1440 慢网|75.3→88.5|306.9→298.1|133.0→122.1|2352.6→1420.5|

正文/正常首图没有一致改善，不把结果写成全面提速。自然前端波动、重启后JVM状态与环境竞争仍有限制；没有声称生产约1.3秒TTFB已由本候选解释或解决。

独立API三次中位55.9→53.7ms；PG累计parse/bind/execute中位12.40→3.53ms，响应均2048B。源码与实际SQL确认主商品读取由全目录变为按ID，当前价/评分/路径/标记仅投影该商品。这里无已发布推荐项，生产历史推荐数量的影响未由合成数据量化。完整公开/已发布私有参考的隔离边界由直接单测验证。

慢网基线图1/2几乎同时开始，图3/4约19ms后加入。候选图2在首图网络完成后12–21ms开始，图3/4各后移约0.45秒：实际低优先级、逐张下载，未提前批量加载。首图解码后才释放背景队列；提前选图直接提升所选URL，旧后台请求不再阻塞选择；首图错误同样释放队列。

列表仅作本批基线：同一叶类20返回/20挂载，390可见2、1440可见12（部分可见也计入）。生产样本是24/24/2或6，不能跨数据求提升。列表首卡和首图全部原始中位数见`summary.json`，本详情PR不声称改善列表。

## 验证与边界
- 后端`PublicProductCatalogServiceTest,PublicProductBrowseServiceTest`：26 PASS；覆盖单品不全表读取、公开/商家/软删/未知状态、私有仅既有发布事实、未发布不披露及旧分页合同。
- 前端`RecommendationImageViewer.test.tsx,ImageLightbox.test.tsx`：12 PASS；覆盖逐张、提前选择、失败释放、原有手势/键盘/全屏。
- tsc/vite PASS。custom outDir后原postbuild寻找dist失败，直接对该输出目录调用原renderHome完成，未重复打包。候选入口`index-BdxiN0wE.js`。
- 24轮自然浏览器基线/候选无JS/控制台错误；未变的列表过滤、分类顶栏/侧栏/价格权限复用#175证据。本批不修改买价或结账授权。
- 原生PR CI待记录；正式发布由本机协调。代码无schema/数据迁移，应用回退兼容。

完整截图为`baseline-detail-*`/`candidate-detail-*`；补充`candidate-media-*`含首图等待、失败后切图和360原尺寸局部。所有图片都是合成测试数据。最终边界结果见`media-edges.json`。
