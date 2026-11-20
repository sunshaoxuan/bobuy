# 价格纠错真实UI证据

- `browser.json`：合成商品的私人隔离、重复单作废、单位纠正、重复确认、明确发布、刷新读回、公开分类/搜索/详情。`finalGeometry/finalNetwork/finalErrors`为补正夹具及动画等待后的结果；较早network/截图保留失败事实。
- `publish-blocked-*-390.png`：拒绝发布的四语稳定几何。`unit-final-*`后被本机发现复选框分行，已由下述unit-checkbox图取代，不再作为最终视觉通过图。
- `public-search-*`、`public-category-*`、`public-detail-390.png`：明确发布后合成JPY2998/箱。素材为明确标注合成商品的占位图。
- `initial*`及`failure.png`：调查/失败记录，非通过截图；首次取消截图包含测试夹具缺表的无关轮询错误，已由cancel-preview-final图取代，相关实际作废功能PASS继续复用。
- `final-jar-readback.*`、`final-jar-private-*`：最终共同JAR已实际加载后的只读私价隔离、分类路径和价格面板验证。此夹具重建为 `--after-cancel`，不冒充业务写入后数据库重启恢复。

当前打包产物（不提交二进制）：
- `/workspace/bobuy/bobbuy-core/target/bobbuy-core-0.1.0.jar` SHA256 `8cd619689f0044fd30dd7353ea47c6c34dd099687f38a4f779090c65f0636375`
- `/workspace/bobuy/bobbuy-common/target/bobbuy-common-0.1.0.jar` SHA256 `eb2c5e88373e53e4dab89137991979e25bd7f2354f65cd9639a2377338232ba6`

浏览器功能阶段以真实Spring Boot target/classes运行；最终打包后只读阶段使用common JAR作为类来源，日志确认 `PRICING_CLASS_SOURCE=file:/workspace/bobuy/bobbuy-common/target/bobbuy-common-0.1.0.jar`。其余最终差异由对应定向测试覆盖，未重跑无变化写流程。Vite实际加载变换模块摘要在JSON中；不是生产构建资产。Core JAR已构建，未声称完整微服务生产拓扑已运行。

夹具与浏览器脚本仅用于loopback合成环境。`PriceCorrectionRuntime.java`硬编码内存H2、建测试空队列表、种子demo账号和唯一SYNTHETIC商品；启动需为本进程生成随机JWT测试密钥，不打印或落盘。编译类路径为common JAR、backend test-classes和已有测试依赖，启动时将夹具目录放首位。前端Vite5173代理测试后端18080。执行 `node .../browser.mjs` 后，`finish-browser.mjs`补缺失截图；它们是本次有状态验收脚本，不是可对任意数据库执行的回归工具。`final-jar-readback.mjs`只读业务数据（登录取得仅内存会话）。不得将任一脚本指向生产。

失败/重跑原因及预算详见正式计划；验收矩阵、四项商家操作、兼容及生产回退边界详见现有PRODUCT-PRICING-RELEASE.md。云端没有生产写入、合并或部署。

## 本机视觉反馈后的最终图（唯一收口范围）

- `visual-final.json`：复选框同排flex、四语360/390以及英文1280的整图/局部几何；标签热区和按钮均≥44px，框与文字同排相交，面板左右边界在视口内，无横向溢出。业务请求仅GET，无实际作废写入，前后history/regular完全一致；无JS错误或网络失败。原disabled属性不变，禁用文字颜色保留。
- `unit-checkbox-{locale}-{360,390}.png`及`-checkbox.png`：最终单位纠错整图及局部，取代unit-final旧图。`unit-checkbox-en-US-1280.png`为对应桌面图。
- `cancel-preview-final-{360,390,1280}.png`及`-checkbox.png`：同一内存夹具重建原始两张已批准永久单，仅打开已验证可作废的SECOND预览，没有提交作废；无500提示。
- 唯一新增应用差异为productPricing.css。common/Core JAR未改、不重建，后端与此前价格写入检查复用；新的实际加载CSS模块哈希见visual-final.json。360×844为此反馈追加的必要视口，没有扩大其他页面测试。
