# 消费者 UI dev3 — 独立回焦差异 QA

2026-11-08 UTC。**结论：FAIL / LOCAL_CANDIDATE_NOT_ACCEPTED / NOT_RELEASED。** 原“推荐关闭后焦点落BODY”的问题已修复到正确控件；但独立交叉检查确认关闭后滚动回顶、焦点控件留在视口外的 P2，完整返回体验仍不合格。D10实际语音按PM决定保留 `NOT_RUN / ACCEPTED_LIMITATION_NON_BLOCKING`，不阻断本批；本次阻断只有下述真实UI问题。

仅使用同一 OHR0067、唯一 media-upload-fix 根和原七容器。未修改应用源码、提交/push、启动第二栈/库、调用生产、读取凭据或写业务数据。原R1/R2报告、失败、发布及恢复证据保留。

## 候选绑定

- `consumer-ui-20261108-dev3`，未提交，HEAD仍 `fc57d58e773f730158cc827a1c4d221ebce1a594`。
- [开发manifest](../../frontend/test-results/consumer-ui-20261108/r3/SOURCE-MANIFEST.json) SHA256 `481c604f27c7f2424657b125ce1d1af93d66c327f006fd593d3d40a1538b1dc4`；33文件有序sourceDigest `ac23f30c77adab4d4e67ef12b07b4e44d88b8ce13eef35a0d0b0ffc93c93f0b4`。独立重算一致，109个交付文件哈希均匹配。
- 相对dev2仅四文件：RecommendationBrowse.tsx、PublicRecommendations.tsx、新useDetailReturnFocus.ts及其测试；原加号资格/对比样式、后端、权限、标记/报价逻辑未变。
- 实际web index `a2b2e87c8339f4324c0a44394fd302da6f78ca8241eb5eacf25f10694061b119`；实际JAR仍 `1ac5d916ca78498e04ffaad0338af38505fde17c455f991cc34aeb8c6cc84a5b`；原七容器ID/image保持。开始/结束匿名本地六个API响应字节一致。
- [初始绑定](../../frontend/test-results/consumer-ui-20261108/qa-r3/BINDING.json)、[最终绑定](../../frontend/test-results/consumer-ui-20261108/qa-r3/BINDING-FINAL.json) 为独立实际回读；后者的PASS仅说明输入保全/资源释放，**不等于功能验收PASS**。

## 新 P2：关闭后滚动回顶，回焦控件不可见

标识 `P2-REC-DETAIL-SCROLL-RESET`。真实最终Edge资源、浏览器内合成API及归档官方原图；原图正常加载，不需要账号、真实商品修改、订单或支付。

最小复现：390×844访问 `http://127.0.0.1:18080/?node=883010&query=keep` 的首页推荐模式；等待页面/图片/字体稳定，聚焦卡片品名，滚动位置637，品名位于视口y376.7–466.3。按Enter打开详情，再Escape关闭。等待网络idle及六个动画帧，scrollY仍为0，实际焦点是相同逻辑卡的品名BUTTON，但其y1167.2–1256.8，完全在视口外。node/query保留，item移除，topic按原逻辑保留。

桌面1440×900也复现：品名前scrollY539、y413.8–486.2，关闭后scrollY0、y1084.3–1156.8。桌面照片41→0，手机当前推荐品名8→0、预选期照片74→0也有稳定位置变化。前两项的大幅回顶和不可见焦点足以构成P2；不以小差值独立扩大缺陷数量。

| 路径 | 打开前scrollY | 关闭后scrollY | 关闭后焦点 | 控件top / viewport |
|---|---:|---:|---|---|
| 首页品名，1440×900 |539|0|BUTTON/name|1084.3 /900，屏外|
| 首页品名，390×844 |637|0|BUTTON/name|1167.2 /844，屏外|

主要证据：[GUI-scroll-diagnostic.json](../../frontend/test-results/consumer-ui-20261108/qa-r3/GUI-scroll-diagnostic.json) 保存before/opened/immediate/settled-after、控件矩形、焦点与原生focus/scroll trace；[手机打开前](../../frontend/test-results/consumer-ui-20261108/qa-r3/scroll-diagnostic-before-home-name-390.png) 与 [关闭后](../../frontend/test-results/consumer-ui-20261108/qa-r3/scroll-diagnostic-after-home-name-390.png) 已独立看像素。此诊断回执中的checks PASS仅表示记录过程完成，其result明确是`COMPLETED_SCROLL_DIAGNOSTIC_NOT_ACCEPTANCE`，不能把非零delta改称验收通过。

[useDetailReturnFocus.ts](../../frontend/src/components/useDetailReturnFocus.ts) 最后执行focus(preventScroll:true)，能避免主动滚动，却没有保存/恢复打开前浏览位置。主页/当前卡打开又由 [RecommendationBrowse.tsx](../../frontend/src/pages/RecommendationBrowse.tsx) 引入topic并重建列表。已观察到打开阶段变为scrollY0，关闭后仍保持0；列表重建/页面高度变化是相关源码路径，**尚未把具体高度收缩或锁滚实现断言为唯一根因**。原开发应在稳定owner中保护打开前的位置/逻辑卡锚点，并在关闭与列表就绪后恢复可见的触发位置；覆盖原DOM尚存、同卡重建及合法回退，不通过删断言或允许回顶放行。QA未代改实现，也不认定此问题一定由R3新增。

## 开发测量纠正的独立判定

开发将“抽屉打开时”改为“打开前”作为基准，**方法正确**。已实际读取原`focus-cases.txt`，其正常路径确实在drawer可见后才记before；`focus-replay.txt`已把它移动到Enter之前。开发三次probe均为539→打开455→关闭539，支持那一个selected-name测量纠正。

但该单条解释不能证明原其余22条滚动断言有效。它们的焦点断言可保留，而使用打开态作为before的滚动PASS不证明回到打开前位置。本次独立执行纠正后的全部聚焦输入，25条中有6条滚动断言失败；追加五条诊断在网络/字体/布局稳定后仍复现上述差异。详见 [MEASUREMENT-REVIEW.json](../../frontend/test-results/consumer-ui-20261108/qa-r3/MEASUREMENT-REVIEW.json)。没有更改应用来修测试，没有覆盖原开发FAIL或新独立FAIL。

## 真正新增执行与复用

本次没有重跑七项全套：

- **6/6新hook单测独立运行通过**：[HOOK-TESTS.json](../../frontend/test-results/consumer-ui-20261108/qa-r3/HOOK-TESTS.json)，jsdom；覆盖原控件、同类重建、失去目标回退、无opener、动作/scope取消、超时后不夺焦。
- **25条回焦浏览器序列独立运行**：[GUI-focus.json](../../frontend/test-results/consumer-ui-20261108/qa-r3/GUI-focus.json)。19条整体PASS、6条滚动断言FAIL；所有实际目标身份/非BODY断言都先通过。12条桌面/手机首页/当前/选期×照片/品名、两级Escape及browser-back、真实404、无opener深链、移除目标heading回退、异步同卡重建、第二页连续关闭、私有只读预览均执行；额外两条真实浏览器检查500ms期限回退与新用户动作后，晚到数据不夺焦。
- **5条稳定滚动诊断**，只记录问题，未计成验收PASS或新增独立业务用例。
- 334次真实JS/CSS资源响应全部匹配dev3构建。两浏览器运行pageErrors0、尝试服务器写入0，context/browser已关闭。没有本次Java程序。
- 原开发28/28、type/build/prerender仅按精确输入复核复用，不冒称本次又执行28项。其余既有独立证据按下表保留边界，不重复累计测试数。

第2页48卡连续button/Escape/back保持原ID集合与精确滚动：桌面8681、手机13685；这是有效正例，不会掩盖首页回顶。无opener深链回到同逻辑照片，目标移除回到当前H1；超时后H1和用户已点击的搜索INPUT均不被晚返回卡夺焦。共享私有预览品名回焦正确、无加号/来源，仍为完全拦截的模拟身份，无实际登录。

## D1–D13 当前裁定

| ID | 状态 | 本轮或复用证据 |
|---|---|---|
| D1 | PASS（复用） | 详情/图库/价格排版源未改，R1/R2桌面手机布局/自然图及实际像素证据有效；本次恢复控件/第2页图已看。 |
| D2 | FAIL | 来源移除、真实404 alt、入口身份及私有预览继续PASS；回焦虽到正确控件，首页控件在屏外，完整可用返回仍不合格。 |
| D3 | FAIL | 两级Escape：全屏→inline→卡片及后退均通过；原图库/手势证据复用。首页卡片焦点不可见，按新P2阻断完整回焦体验。 |
| D4 | FAIL（交叉） | 新测第2页加载、相同ID、8681/13685连续位置保持通过；原错ID/409/晚响应/URL证据有效。但已确认首页关闭滚动回顶，不继续把整项记PASS。 |
| D5 | PASS（复用） | R2日本四边界、未知/冲突/券期间、同金额不同渠道单位分立及实际价门禁，相关源/JAR未变。 |
| D6 | PASS（复用） | 原六角色浏览器mock/服务mock边界有效；本次共享私有只读预览回焦补测通过，不新增真实登录声明。 |
| D7 | PASS（复用） | HomeBrandIntro、导航、SEO/prerender语义源未改；原无JS/三链接/选中及上下文证据有效。 |
| D8 | PASS（复用） | R2名字UI矩阵及11项生产服务repository-mock、实际匿名nodes readback；服务/JAR与调用逻辑未改，无改名/重发。 |
| D9 | PASS（回读+复用） | 原官方图、源码/制品、provenance/history/样本保全、保护脏文件及原QA证据哈希保持；无业务写入。 |
| D10 | NOT_RUN / ACCEPTED_LIMITATION_NON_BLOCKING | 仅实际语音；PM PLAN 07:31决定、07:52重申接受。四语键盘/ARIA/nativeAX PASS复用。不再启动读屏、改设置或安装软件，不伪造语音PASS。 |
| D11 | PASS（复用+差异审查） | hook只观察已加载DOM/就绪状态，无fetch；原24/20有界请求及懒加载证据有效。第2页ID/重复关闭无追加全量请求逻辑。 |
| D12 | PASS（复用） | 原无行程/白底图标两个P2保持独立关闭；Storefront、ReservationAdd和CSS与dev2一致，报价/99/跨商家等R2有效证据不重跑。 |
| D13 | PASS（复用） | 原0→1→0浏览器mock、18服务mock及真实匿名28对搜索0统计，相关源/JAR未变。没有清库或重新真实登录。 |

共9 PASS、3 FAIL（同一新滚动/可见性P2影响）、1非阻断NOT_RUN。本报告不推翻既有正向子场景；它明确新增失败覆盖到的范围。

## 资源、数据与归还

所有工作在原根证据子目录`qa-r3/`，未建应用副本/测试服务/数据库。当前真实API仍28标记、搜索0而全范围28，未知商家0且不回退；六个真实匿名响应开始/结束字节一致。模拟API全部在隔离Edge内，真实登录0、实际业务写入0、生产调用0，无数据库恢复需求。原图字节不改，保护`scripts/local-test.ps1`仍SHA `4e8a397f1d819ced5eb6e23d601b005c74a0a94a963547e1ccae2c5099ffb4b9`。

本次unit worker和浏览器均已结束；原七容器保持原身份且运行，JAR未替换/重启。原R1/R2 QA文件和失败回执哈希均保留。唯一根归还协调方，无在途测试或后续写入。没有正式审批拒绝，不因D10另开工作。

下一步只交原开发最小修正该真实滚动问题，重新绑定后对上述失败路径与必要交叉项窄验。精确候选尚未提交，新CI/CodeQL/依赖安全及整批core/web发布制品绑定/受控发布审核仍未执行；不能用旧fc57 CI覆盖dev3，不能漏掉本批原有后端读投影。生产仍是先前接受20261107.1/fc57。本地候选尚不接受，更没有上线。

交付：[QA-RECEIPT.json](../../frontend/test-results/consumer-ui-20261108/qa-r3/QA-RECEIPT.json)、[SHA256SUMS.json](../../frontend/test-results/consumer-ui-20261108/qa-r3/SHA256SUMS.json)。
