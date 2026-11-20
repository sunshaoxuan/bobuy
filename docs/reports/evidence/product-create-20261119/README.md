# 手动新建商品验收（问题五 / PR #163）

基线为已上线 main `8540e5a8b9a7349240a9d174b787388e84fcdb20`。本目录仅包含合成数据，真实SKU 89863未创建，云端无生产读写/合并/部署。源码及运行class摘要见 [acceptance.json](acceptance.json)；最终提交和原生门禁状态在PR中绑定，避免仅为更新SHA反复触发CI。

## 结果与证据
- 后端13项有效PASS：ManualProductCreationTest 5、MobileProductControllerTest 2、ProductCatalogIntegrationTest 6；前端StockMaster 21项有效PASS，typecheck PASS。按正式任务文档记录的失效输入最小重跑，非完整集合重复执行。
- [browser.json](browser.json)：真实Spring Boot + PostgreSQL18.6 + Vite + Chromium，填入中日英名称/描述/规格、品牌、ITEM及当前分类，手机显式保存取得服务器ID，刷新仍存在，现有主档编辑保存可读。最初最后一个无AI断言误把既有GET轮询计入，恢复阶段只读复用原商品；无重复业务创建。
- [integration.json](integration.json)：真实PG非法分类回滚、匿名拒绝、同请求并发幂等、未分类保存、重复ITEM拒绝；新商品通常价确认后仍私有，既有显式发布才公开JPY2998报价。V46真实触发器存在，未退回旧类目。
- [visual.json](visual.json)：四语1280×800与390×844新建及保存后编辑入口，10张最终稳定PNG、实际计算样式和加载模块摘要；无JS/网络错误、无横向溢出；新建可操作控件≥44px。选择器内部搜索input按外层44px选择器命中区计量。
- [form-final.json](form-final.json)：最终代码已填表单与分类选择3张稳定PNG，仅本地填表，业务写入0。早期initial.png已移除；browser.json原几何被这两份最终回执替代。
- 主Agent已看英文手机、日文桌面、中文手机和保存后编辑手机原图。既有主档编辑器的未改控件预算不冒充本批新建全控件验收；本批新建区域按44px验收。

## 定向命令
```sh
# 使用工作区既有JDK/Maven依赖；运行记录见正式指导，已PASS者勿重复跑。
mvn -f backend/pom.xml -Dtest=ManualProductCreationTest,MobileProductControllerTest,ProductCatalogIntegrationTest test
cd frontend
npx vitest run src/pages/StockMaster.test.tsx
npm run typecheck
```

实际开发分段运行以上相关集合，失败修复后只重跑失败方法。真实PG夹具入口 `ManualCreateRuntime.java` 固定环回 `15432/manual_create_synthetic`、应用18080，无生产参数入口；使用postgres:18.6-alpine3.23，真实V1..V46。`browser.mjs` 首次仅执行合成创建，`--resume`复用原件，`--form-only`只拍填表；`finish.mjs` 执行剩余合成集成，`--visual-only`仅拍图。运行脚本需既有Vite代理指向18080；合成会话只保存在进程内，不提交原始日志/凭据。没有部署生产或启动AI worker。

## 限制与交接
新建私有，不自动确认通常价或发布；JSON补齐仍只处理已有ID。失败保留当前页输入，刷新前未保存的草稿不承诺持久化。相同请求重试返回原商品，不覆盖；不同请求同ITEM（含软删）拒绝，须找到原商品。生产观察仍需本机按最终精确版本验收。没有新schema迁移；回退到8540e5a8可保留新商品/路径/价格，但旧版手动新建故障重新出现，且旧主档服务不接受视频原件随其他字段保存，需保留兼容版或前向修复该编辑能力；不得回滚#162分类清理。

## 360×800追加画面复核（应用源码26453d6）
复用现有隔离环境，执行 `node docs/reports/evidence/product-create-20261119/visual-360.mjs`。中文及较长日文各保留新建表单、分类展开、选定分类的360×800整图，以及保存区、分类选项、选定字段的DPR1原尺寸局部，共12张PNG（文件名含`360`）。[visual-360.json](visual-360.json)记录几何、计算样式、字形文本框及网络。

主Agent已查看中日文整图、主要保存区及分类局部：标题/保存文案完整，长日文名称可见；保存/取消均44px高、间隔8px，表单测量控件最小44px，文字框无越界，无横向溢出，分类展开和选中路径可读。表单需纵向滚动；既有标签导航在窄屏保留溢出菜单，不宣称所有标签同时完整可见。分类弹出选项已目视和实际选取，本轮未单独记录每个树节点的热区几何，不将表单44px结果外推为每个树节点的测量结果。

无JS或网络错误，记录的业务请求均GET，商品写入0；仅填本地草稿后关闭，没有点击保存或重复创建。保存行为复用既有PASS，本轮仅复核保存按钮画面。应用源码、打包产物和测试输入未变，13后端/21前端、typecheck及390/1280结果复用。26453d6原生[PR checks](https://github.com/sunshaoxuan/bobuy/actions/runs/44454521574)及[CodeQL](https://github.com/sunshaoxuan/bobuy/actions/runs/44454521594)均成功；追加证据提交的自动门禁在同一PR跟踪。
