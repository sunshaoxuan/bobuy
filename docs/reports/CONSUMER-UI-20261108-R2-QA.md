# 消费者 UI dev2 — 独立差异 QA

2026-11-08 UTC。**结论：FAIL / NOT_RELEASED。原两个 P2 已独立关闭；补验发现一个推荐详情关闭回焦 P2。D10 仅实际语音读屏仍 NOT_RUN。** 没有修改应用源码、提交/push、部署或生产调用。原 [dev1 FAIL 报告](CONSUMER-UI-20261108-QA.md) 和回执保持原字节，不覆盖历史结论。

## 精确候选与执行边界

候选 `consumer-ui-20261108-dev2`，仍是 HEAD `fc57d58e773f730158cc827a1c4d221ebce1a594` 上的未提交工作树。独立核对 [R2 manifest](../../frontend/test-results/consumer-ui-20261108/r2/SOURCE-MANIFEST.json) SHA256 `37a5ddcd4a19917c47911da2d85ca94bde669599b9855f7d4b0ef32844a42aed`，31 文件有序 sourceDigest `ef738953ce56778a235a1f437d9faf6f8b61d496f4b1499ff10408738ef7e58f`。

与 dev1 精确比较，只有 ReservationAdd.tsx、consumer-detail.css、Storefront.tsx 三个应用文件及其两个测试文件不同。114 个交接/源码/配置/制品/回执文件初始哈希全部一致。实际本地 web index `1989e08d92309fd7b7d9db4fe6ee92f8af4fdf32e3df4941d8d38a32126d54df`；JAR 仍为 `1ac5d916ca78498e04ffaad0338af38505fde17c455f991cc34aeb8c6cc84a5b`，原七容器 ID/image 不变。详见 [初始绑定](../../frontend/test-results/consumer-ui-20261108/qa-r2/BINDING.json) 和 [最终绑定](../../frontend/test-results/consumer-ui-20261108/qa-r2/BINDING-FINAL.json)。镜像ID不代替覆盖后的实际文件哈希。

全部网页实测使用同机现有 localhost18080 最终资源、独立非持久 headless Edge。API 数据在浏览器内全部拦截，使用归档原始官方图片及合成列表/报价/行程/名称；不生成真实订单、不付款、不使用真实登录或用户浏览器。匿名真实本地 API 只读核验与浏览器 mock 分开记录。D8 新 Java 主程序只调用实际服务与 repository mocks，没有 Spring 启动、第二数据库或清理动作。

## 已关闭：原两个 P2

**原无行程加号 P2：PASS。** 独立审阅后实际执行定向脚本，1440/390 下无同商家可预订行程、只有异商家行程、加载未返、503、无实际报价、负价、过期报价都不显示加号；进行中行程仍正常浏览。真实合格报价+行程时沿原数量/购物车回调，99 上限、禁用增量、重开99、一次 tap/Space/Enter 各只触发一次，不误开详情。迟到旧节点报价不点亮当前无行程商品，未知报价完成后才出现加号，到期撤下并回焦当前照片。没有恢复全量商品预取。

**原白底白图标 P2：PASS。** 最终真实计算样式和独立像素复核：白 SVG/前景、`rgba(32,37,32,0.76)` 背景、44×44；白/黑底端点对比分别7.09:1/17.21:1。hover 保持深底，键盘焦点有3px轮廓与白间隔。已看 [桌面焦点](../../frontend/test-results/consumer-ui-20261108/qa-r2/p2-fixed-plus-root-focus-1440.png) 和 [手机加号](../../frontend/test-results/consumer-ui-20261108/qa-r2/p2-fixed-plus-products-390.png)。

主要证据：[GUI-p2.json](../../frontend/test-results/consumer-ui-20261108/qa-r2/GUI-p2.json) 为25个定向序列通过，8次样式观察另列；它是独立执行已审开发断言，未把开发回执改名成QA。新增首页推荐/marked/历史卡及跨商家取消保护见 [GUI-names.json](../../frontend/test-results/consumer-ui-20261108/qa-r2/GUI-names.json) 的相应 PASS，未重复合计旧运行数。D6 私有只读预览及D13沿原明确边界复用。

## 新 P2：推荐详情关闭后焦点落到 BODY

**状态：已复现，未修复；影响 D2/D3。** 不是图片404造成，也没有证据表明由 dev2 五文件增量引入。

最小复现（合成浏览器夹具、实际 dev2 页面）：

1. 在1440×900或390×844访问 `http://127.0.0.1:18080/recommendations?topic=7&node=883010`，正常图片完整加载。
2. Tab/程序定位到卡片照片按钮，用真实键盘 Enter 打开商品详情。
3. 点击详情关闭按钮。等待 Drawer 不可见，并允许1秒回焦。
4. `document.activeElement.tagName` 为 `BODY`；原照片按钮仍连接在 DOM 中，却没有焦点。预期回到该触发器。

首页推荐模式、未选期推荐列表和预选期推荐，在两个宽度六个正常图片场景全部复现。预选期场景原触发器仍连接，排除了“只有列表重建才丢焦”的解释；首页/当前列表打开时变更 topic 又会重建原卡片。图片实际404下，推荐的品名/照片四个补验也同样失败；商品模式的品名/照片四个流程则正常回焦。

直接证据：[GUI-focus-final.json](../../frontend/test-results/consumer-ui-20261108/qa-r2/GUI-focus-final.json) 的 `focusFindings` 保存正常图已加载、关闭前原触发器连接数、关闭后BODY、URL和focused=false；[GUI-images.json](../../frontend/test-results/consumer-ui-20261108/qa-r2/GUI-images.json) 保存404下的推荐失败/商品成功对照。截图只辅助，焦点断言与DOM记录是主要证据。

源码支持：[RecommendationBrowse.tsx:73](../../frontend/src/pages/RecommendationBrowse.tsx:73) 删除item，父级以itemId条件渲染详情；[PublicRecommendations.tsx:105](../../frontend/src/pages/PublicRecommendations.tsx:105) 也仅在有item时渲染已打开Drawer。关闭会直接卸载推荐详情，没有稳定页owner中的触发器恢复处理。相比之下 [PublicProductCatalog.tsx:133](../../frontend/src/pages/PublicProductCatalog.tsx:133) 保留Drawer并切open=false。建议原开发保存逻辑卡片触发器，并在关闭/列表已就绪后恢复焦点；覆盖仍在DOM与被scope重建两类，及全屏→详情→触发器的两段关闭。QA未改应用。

## D1–D13 裁定

| ID | 当前状态 | 本次证据 / 复用范围 |
|---|---|---|
| D1 | PASS | 复用相同详情/图库/排版源的原独立1440/390/375像素与布局证据；新桌面手机加号、404详情、长列表第30商品及参考条件截图已独立看图。不是生产/跨浏览器兼容声明。 |
| D2 | FAIL | 已补两个首页模式、品名/正常照片入口、真实HTTP404、complete且naturalWidth=0、商品名+序号alt、全屏无文件名/来源DOM，以及关闭node/query保留。来源移除与破图内容通过；推荐关闭回焦P2失败，商品模式回焦通过。原直接深链/私有预览同源证据复用。 |
| D3 | FAIL | 全屏关闭回到内联图库、图库手势/边界/原尺寸等同源原证据继续有效；本次证明“详情回到卡片触发器”在推荐路径失败，因此原有限PASS不能冒充当前整项PASS。 |
| D4 | PASS | 48商品两页，桌面/手机第30卡打开关闭、加载ID集合保持、滚动差小于4px、后退前进及node/query/category保持；旧A列表及旧I详情晚返不覆盖B/J；未知node无回退、错ID404无内容、续页409显示刷新且不混页，刷新回24条。普通深链刷新沿原证据复用。证据 GUI-paths 的D4四项。 |
| D5 | PASS | 固定浏览器时钟实测日本首日前一毫秒、首日零时、末日最后毫秒、次日零时，完整期间前/中/后tag正确。等额1518的仓库70×15、Online一箱、unknown-start/UNKNOWN三份参考事实保持分立；CONFLICT、券发放10/25–30与兑换11/2–8分离；无实际报价仍禁买。原价1848/折扣330/非售价保留。证据 GUI-remaining 的四日期场景和事实文本。此为浏览器渲染fixture，不冒充服务端报价重新计算或改价；实际报价时效另由D12独立通过。 |
| D6 | PASS（复用） | 按原六角色浏览器mock/服务仓储mock及私有预览边界复用。权限、编辑器、后端未改；没有新真实登录或持久化权限成功声明。 |
| D7 | PASS（复用） | 首页品牌/导航/prerender语义源未变，原无JS/SEO/homePath证据有效；R2实际主页图及未增加全量请求已核。无生产robots/sitemap操作。 |
| D8 | PASS | repository mock实际服务11项：只查已发布merchantIds、同名不同ID、空白/缺用户/null中性回落、推荐-only保留、trip-only/private不进入推荐nodes、历史publisherId/merchantId/name/version不变且无save。浏览器补推荐-only直接标题、空名/缺用户不回落旧名、trip-only公开行程、同名两选项实际切883011、迟到旧行程名不覆盖Current B、刷新仍保留历史A。证据 NAMES-SERVICE、GUI-names相应PASS及GUI-name-select。未做账号改名/重发。 |
| D9 | PASS（复用+回读） | 当前输入/实际制品绑定、原官方图字节、原QA全部证据保留；真实本地六个公开响应开始/结束哈希相同；无迁移/真实商品、价格、订单或账户写入。原保全证据有效。 |
| D10 | NOT_RUN（仅实际语音读屏） | 本次独立补空目录、503→重试、四语完整长标题在1440/390换行不溢出、20→25仅显式更多、两次请求、Escape回焦/展开状态/ARIA关联及原生CDP AX名称，均PASS。实际辅助软件语音走查未执行，能力与替代详见下节；不能以DOM/AX代替它。 |
| D11 | PASS（复用+差异） | 目录/分页算法未改，原按需时序有效；新增目录实测一次20、手动第二次5，不因焦点/展开多拉；商品仍24页/有界报价，无资格判断全量products请求。服务器内部扫描成本未做基准。 |
| D12 | PASS | 两原P2已关闭；25定向序列、额外首页推荐/marked/history单次触发/不误开详情、数量99及跨商家确认取消保留原cart通过。预览只读/无购买按D6同源复用。只改浏览器cart，不提交订单或付款。 |
| D13 | PASS（复用） | 按原浏览器mock0→1→0、18项仓储mock服务和真实匿名API总数28对搜索0的边界复用。编辑器/统计服务/JAR未变，真实读回仍一致。不新增真实账号登录或清空28个已有标记。 |

当前共10 PASS、2 FAIL（同一个新P2）、1 NOT_RUN（实际语音读屏一个子项）。原五个NOT_RUN的应用/浏览器场景均已执行；回焦有实质失败，D10保留具体能力边界。

## D10 实际读屏能力与替代

先读取computer-use技能及当前CUA能力/本机应用窗口库存，未发现运行中的读屏器窗口/表面。当前公开工具仅支持截图、可访问树、键盘/指针，没有读屏语音、speech viewer或音频输出捕获。**这不证明系统没有安装Narrator等可执行文件，也不是正式拒绝。** 没有启动/下载未知软件，没有改用户无障碍设置或触碰用户浏览器。

可用替代已实际执行：原生Edge键盘、四语控件完整可访问名称、expanded/controls/focus，以及CDP Accessibility.getFullAXTree中的完整标题/日期/计数。详见 [SCREEN-READER-CAPABILITY.json](../../frontend/test-results/consumer-ui-20261108/qa-r2/SCREEN-READER-CAPABILITY.json) 和 GUI-remaining 的nativeAX。这些不是实际读屏语音PASS。剩余为真实辅助软件/人工读屏走查，或协调方对这一个子项作明确接受决定；本QA不擅自豁免。

## 失败记录、数据与资源

保留本轮所有失败回执，不覆盖原QA：首轮全404使列表照片按钮随原onError隐藏而无面积，品名入口仍可用，随后把可达的品名破图流程与正常照片→详情404流程分开验证；没有force点击隐藏元素。D5第一断言把既有中文语言包的`Costco Online`误写为“线上”，更正验收脚本后只重验日期。四个桌面长标题最初在108→300px动画未结束时量宽，截图已显示自然换行；等待既有300px稳定后重新量到scrollWidth=clientWidth=186，四语均过。D8误点被选中标签覆盖的内部input，改点实际可见Select外壳后单独通过。一个只读汇总CLI有语法错误，未执行汇总动作，后续文件化收口。以上是验收脚本问题；推荐回焦在正常/404、桌面/手机重复实测，是应用缺陷。

本次真实业务写入0，新真实登录0，生产调用0。所有模拟状态随context关闭释放；没有数据库恢复需求。CurrentNames服务夹具结束、所有本次Edge context/browser关闭，原七容器保持运行且未重启。`scripts/local-test.ps1`仍为`4e8a397f1d819ced5eb6e23d601b005c74a0a94a963547e1ccae2c5099ffb4b9`。唯一根归还协调方，无在途命令。QA新增仅本报告与 `qa-r2/` 证据目录。

原开发62项前端/25浏览器自测以及旧相关测试按输入匹配复用，未虚记为本次独立全量单测。新D8生产服务的编译class与实际JAR匹配。实际页面资源响应哈希和完整源码/制品/报告/回执哈希见 [QA-RECEIPT.json](../../frontend/test-results/consumer-ui-20261108/qa-r2/QA-RECEIPT.json) 与 [SHA256SUMS.json](../../frontend/test-results/consumer-ui-20261108/qa-r2/SHA256SUMS.json)。

下一步：原开发修复推荐关闭回焦P2，绑定受影响输出后做窄回归；协调方处理D10实际读屏子项。精确新候选提交、CI/CodeQL/依赖安全、发布制品与适用受控发布审核均仍未执行。旧fc57 CI不覆盖dev2，生产仍是先前验收的20261107.1/fc57，不能宣告本批已上线。
