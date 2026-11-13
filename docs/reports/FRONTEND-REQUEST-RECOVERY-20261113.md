# 前端请求失败与恢复机制调查

## 目标与范围
用户反馈页面闲置后或浏览器首次加载时出现“请求失败，请稍后再试”，询问前端是否存在重试。调查后用户明确授权补齐自动重试、网络恢复和页面回到前台恢复，避免重复下单，测试验收通过后上线。保留初次调查结果，下一阶段在最新 main 的隔离工作树实施，原目录既有改动保持原样。

## 方法与完成标准
1. 定位提示来源并追踪请求与错误显示路径。
2. 核实自动重试、手动重试、闲置恢复与认证刷新边界。
3. 区分已证实机制与尚缺网络证据的实际失败原因。

## 验证预算与停止条件
仅检查直接相关源码、既有故障记录及必要的公开页面证据。不运行构建、全量测试或发布。完成代码引用和原因边界说明后交付。已有大量未提交改动，全部保持原样。

## 结果
## 实施批次，2026-11-13
授权为实现、相关测试、浏览器验收与上线。隔离工作树 .task-tmp/request-recovery-20261113，基线 origin/main 414a892。任务性质为跨请求和组件生命周期的非机械修改，按 M3 使用 sub2api-agent Claude 建议，主 Agent 决定与落地。当前模型目录包含 claude-opus-5-5-high。

冻结边界：公共商城 GET 的暂态自动重试及共享只读读取所需辅助函数；商城元数据、分页与报价读取失败后的 online/visibilitychange/focus 恢复；对应测试与本记录。排除管理功能扩充、业务数据和后端变更。恢复仅处理挂载中、当前身份的失败读取，保留成功分页、滚动位置、购物车和报价确认，避免切回前台无条件刷新数据集。写入请求、认证刷新策略和结算幂等协议保持当前规则，新增恢复不得调用写入。

预定策略：GET 网络 TypeError、408/502/503/504 最多额外重试2次，500ms和1500ms退避；取消和业务拒绝不重试。恢复事件合并、同任务在途去重、5秒冷却，后台和离线不发恢复请求。所有事件监听与定时器卸载清理。连续失败停止自动循环，等待下一次恢复事件或手动重试。

最小验证集合：新增重试与恢复hook测试；api认证、browse API、分页/报价、商城上下文及Commerce测试，覆盖暂态恢复、耗尽、业务拒绝、重复事件、后台/离线、卸载、过期身份、已有分页和下单次数/请求键。源码收敛后合并运行一次，预计1至3分钟；前端产物build一次，预计1至2分钟；真实浏览器使用生产只读接口并注入局部故障，桌面和390px检查恢复、Console、网络、截图及无写入，预计5至10分钟；精确候选CodeQL跟踪原CI，发布仅替换frontend并绑定回退，生产只读验收。无可见控件改造，不新增布局预算；既有页面显示变化通过真实截图观察，必要时Gemini复核。通过必需项即提交交付，不做全产品回归。

### 已核实
实施冻结：自动重试严格限定 storeGet 的 /api/storefront/ GET，暂态状态包括408/500/502/503/504，额外两次500/1500ms，单次12秒超时；解析与业务校验在重试边界外。公共读取最终错误携带可恢复分类，其他错误不触发恢复。恢复hook按当前身份隔离、250ms合并、5秒冷却，元数据、分页、报价和已打开详情接入，成功数据集保持原样。结算/写入及401策略未变。新增控件、CSS、数据库、后端均无变化。

外部建议：claude-opus-5-5-high两次均返回No available accounts；按降级规则调用deepseek-flash high成功。建议要求网络分类、身份与分页快照保护、事件合并、无checkout重放。已采纳这些约束并加负例；未采纳全局恢复限额，因本批只恢复当前失败资源且每资源已有冷却和在途保护，不增加全局调度层。外部模型未接收凭据、业务数据或完整历史。

正式相关检查冻结为readRecovery、useReadRecovery、api、browseApi、publicCatalogApi、browsePaging、StorefrontContext、StorefrontCommerce、PublicProductCatalog、RecommendationBrowse、CatalogAutoReveal及ProductMarkerCatalog测试文件；共用一次Vitest运行。范围覆盖修改请求层直接消费者及报价/提交边界，无后端或全产品回归。运行后只有具体失败输入的最小修复允许改变候选。

首次检查115项中114通过，browsePaging旧测试读取了新增测试残留的mock调用记录，发生断言失败。失效输入仅为browsePaging.test.tsx的mock隔离，已增加beforeEach mockReset；依赖为该文件内测试顺序，最小重跑命令npm test --prefix frontend -- src/browsePaging.test.tsx，其余11文件PASS复用（tests.log）。产品源码未变，产物build首次执行。

浏览器首轮在launch阶段发现当前Playwright对应headless shell未安装，尚未打开页面，无功能证据产生；已核实系统Chrome存在，验收脚本改用channel:chrome。最小重跑为该browser-check.mjs本地运行，不安装浏览器或重跑产品测试/build。分页19项重跑PASS，合并有效结果115项全部PASS；build的i18n、TypeScript、Vite和首页预渲染PASS。

本地真实Chrome构建产物验收PASS（local-browser.json）：首次502第3次恢复，持续503恰好3次停止；真实浏览器offline到online后仅失败元数据第4次恢复；离线的focus/visibility无请求；前台事件合并恢复一次；成功数据不因前台事件重新加载；购物车内容和请求编号保持不变。桌面1440×1000和390×844截图均已查看，错误提示移除后内容显示正常，无新增布局或CSS变化，无横向溢出。39条console错误均为测试注入502/503或离线造成的预期浏览器资源错误，无应用未捕获错误，无业务写请求。前台事件通过真实浏览器内事件夹具触发，联网恢复通过浏览器实际离线开关触发，未声称长时间休眠实测。

视觉独立意见：实时目录验证gemini-3.8-flash-high可实际接收图片，指出底栏后透出下一行卡片并缺少baseline。gemini-3.1-pro-high图片请求返回upstream_error。主Agent检查同390×844线上baseline和候选：底栏均为fixed、rgba(255,255,255,.96)，相同位置774.703125至844px；页面高度和底部滚动位置一致，末尾操作可滚到导航上方。底栏透出为既有样式，列为独立待评估项，本批不改CSS，不宣称全站视觉无缺陷。首组baseline截图在标记区尚加载时采集，仅几何/样式可用；该证据缺损使同区域截图对比需等待catalog-progress结束后最小重采，不重跑产品测试、build或功能浏览器场景。

首次push的codex/request-recovery-20261113被远端directory file conflict拒绝。只读核实远端已存在refs/heads/codex，故本地改名codex-request-recovery-20261113再push成功，未改或删除远端既有分支。此版本管理纠正不使产品验证失效。

发布前只读核实当前frontend=20261113.heat-top-right.2，revision2160266，镜像sha256:8d02d4e4b249f23f6179b49b3bdfd223c085e853cd9dd7a5ab4d585e98a10ed0；Core=20261112.price-documents.1。2160266到本次基线main的frontend无差异，发布不会夹带其他前端需求。Nacos路由和现有发布library摘要均匹配版本锁。发布计划只替换frontend，保留旧镜像与compose.before.yml作为兼容回退，不执行数据库操作或停写。release-client依赖真实local-browser PASS、精确候选CI成功与产物逐文件摘要；实际prepare/activate/verify使用原生flock和现有保护资源校验。

- 本地 HEAD 为 20db3b4，工作区存在既有改动。Storefront.tsx:105 至 113 的初次读取失败直接记录 error，178 行按钮调用 load。当前本地商城组件未接入 online、focus 或 visibilitychange 恢复处理。全项目其他功能存在网络与可见性监听，不能推导商城也具备相同行为。
- api.ts:760 至 780 只有 401 刷新会话并重发一次；1305 至 1312 的公共商城 GET 禁用该认证重发，没有网络故障或暂态 HTTP 错误重试。
- 2026-11-13 公开首页 HTTP 200，当前线上主资源为 /assets/index-APdX6XSG.js、/assets/index-7JczN2rf.css。Web 检索工具无法访问站点，改用 PowerShell Invoke-WebRequest 只读获取首页及真实主资源。
- 线上主资源与当前本地商城实现存在差异，不能把本地整条加载链当作生产实现。线上共享 GET 函数 zt 直接调用 br，公共接口设置 cache:no-store、retryOnUnauthorized:false；br 只有 401 单次 refresh/replay，没有暂态失败自动重试。线上商城 trips、activeTrips 读取异常直接设置错误，提示栏按钮调用 Ut 手动恢复。以上为实际发布资源检查，不代表完成真实浏览器故障复现。

### 结论与边界
重试机制局限于认证刷新和手动恢复，公共商城读取缺少通用暂态失败重试。失败请求的具体端点、状态码、响应正文和发生时的网络时序尚缺证据，无法把截图归因为会话过期、网关错误或连接问题。当前首页 200 不能证明历史故障原因或已恢复。

### 验收
提示与读取路径定位 PASS；认证与公共 GET 重试边界确认 PASS；生产资源交叉检查 PASS；历史失败根因保持未确认。仅新增本调查文档，已检查引用、范围及结论与源码和读取输出一致。未修改产品、运行测试、构建或发布，未产生任务临时文件。
