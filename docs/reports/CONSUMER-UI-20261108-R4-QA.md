# 消费者 UI dev4 — R4 独立窄验收口

2026-11-08T08:43:00.897Z。**本地候选可接受：LOCAL_CANDIDATE_ACCEPTED_WITH_ACCEPTED_LIMITATION / NOT_RELEASED。** 原六条滚动失败已独立闭合，D2/D3/D4恢复PASS；D1–D13共12项PASS，D10实际语音保留PM接受的非阻断NOT_RUN。此结论只适用于下列精确本地候选，可进入精确提交及CI/安全/整批制品绑定门禁。

同一OHR0067、唯一media-upload-fix根、原七容器；本次只新增qa-r4证据及本报告，没有改应用源码、提交/push、生产操作、业务写入或新栈/库。

## 精确候选及运行绑定

- 候选 `consumer-ui-20261108-dev4`；未提交，HEAD仍 `fc57d58e773f730158cc827a1c4d221ebce1a594`。
- [SOURCE-MANIFEST.json](../../frontend/test-results/consumer-ui-20261108/r4/SOURCE-MANIFEST.json) SHA256 `44b38dd95f00ef7fe4a1a46ad957551f792ec69c7d32a2487f05bada064270f6`；33文件有序sourceDigest `54df7134207712abc391ecfd5f6ecdb8fe3548381035e2b7293332a4b6fbda0d`。开始与结束独立重算一致，开发manifest/handoff中107个交付输入文件全部匹配。
- 相对dev3仅3个应用文件：issue-directory.css、useDetailReturnFocus.ts、RecommendationBrowse.tsx；2个测试文件：useDetailReturnFocus.test.tsx、RecommendationHistory.test.tsx。详情/图库、PublicRecommendations、商家显示名/权限、报价/标记与原两加号P2相关文件保持前轮已验版本。
- 实际运行web index SHA256 `8ded1639926a162b7cb1fbaac3cd3eeba5b95743517302e6c7b0da5084c0a8c4`；实际JAR SHA256 `1ac5d916ca78498e04ffaad0338af38505fde17c455f991cc34aeb8c6cc84a5b`（R4未变）。浏览器154次实际JS/CSS响应全部匹配最终构建，RecommendationService JAR类与现有编译类匹配。原七容器ID/image相同且running。
- [开始绑定](../../frontend/test-results/consumer-ui-20261108/qa-r4/BINDING.json)、[结束绑定](../../frontend/test-results/consumer-ui-20261108/qa-r4/BINDING-FINAL.json)记录真实localhost匿名API、Docker制品、源码及历史证据保全。六个API开始/结束字节相同。旧fc57 CI不能代表该未提交候选。

## 六条原失败：严格开前到关后

本次独立执行真实headless Edge、实际最终web资源与归档官方原图，API全部为非持久context内合成响应。无真实登录。以Enter打开前的open-intent为基准；关闭后等networkidle、fonts.ready及六个动画帧，随后再取六帧稳定样本。判定仍是开前→关后差严格小于4px、相同卡/控件类型、正确可见焦点、原URL、控件矩形保持；没有用打开态作基准或降低阈值。

| 原失败路径 | 打开前scrollY | 关后稳定scrollY | 二次稳定scrollY | 最大矩形差px | 独立裁定 |
|---|---:|---:|---:|---:|---|
| normal-home-photo-1440 | 41 | 41 | 41 | 0 | PASS |
| normal-home-name-1440 | 539 | 539 | 539 | 0 | PASS |
| normal-home-photo-390 | 516 | 516 | 516 | 0 | PASS |
| normal-home-name-390 | 637 | 637 | 637 | 0 | PASS |
| normal-current-name-390 | 8 | 8 | 8 | 0 | PASS |
| normal-selected-photo-390 | 74 | 74 | 74 | 0 | PASS |

六条均为0px滚动差、0px矩形差；实际焦点为原逻辑卡7:235的photo/name BUTTON，非BODY，均有elementFromPoint命中的未遮挡可见部分。个别原控件接近视口下沿，维持原矩形且有可见部分；不冒称控件全幅均在视口内。二次样本无再跳动。

[SIX-RESULTS.json](../../frontend/test-results/consumer-ui-20261108/qa-r4/SIX-RESULTS.json)保留前后坐标、矩形、URL和身份；[GUI.json](../../frontend/test-results/consumer-ui-20261108/qa-r4/GUI.json)保留原生焦点/滚动/路由/DOM时序与请求记录。缺陷 `P2-REC-DETAIL-SCROLL-RESET` 在该精确候选独立关闭；原回焦BODY及原两加号P2保持关闭。旧R1/R2/R3 FAIL、开发dev3 BASELINE-SIX及其原始时序全部保留。

源码/时序审查支持开发根因：旧首页/当前卡详情引入topic时列表cards变0、document最大滚动变0，导致浏览器clamp；选中期手机目录display:none又移除84px布局高度。R4用detailOrigin保留背景列表/topic，卡片关闭回原浏览URL，隐藏目录保留几何高度，hook仅对同scope原/重建目标恢复捕获坐标再preventScroll聚焦。旧根因记录按哈希核验，未为重现旧失败切换现有容器；本次独立DOM保留、无新增列表请求和六条严格返回证据支持修复闭合。

## 本轮真正新增与复用边界

- **指定12条窄验全部PASS**：原六条；桌面/手机两级Escape及浏览器后退；桌面/手机第二页连续button/Escape/back；500ms期限和新用户动作后晚响应不夺焦。
- **另1条合并交叉检查PASS**：当前列表原DOM在详情期间保持、items请求开前/打开/关闭均为1；关闭恢复原node/query/category与原topic；显式点期名可切选期；无opener的/recommendations/7深链保留期号并回同卡photo；移除整卡后回当前H1且不写旧scroll；无全量/api/storefront/products请求。这是对本轮背景上下文改动的必要补测，共13个独立浏览器序列，不累计开发25条。
- **7/7 hook单测独立运行PASS**，[HOOK-TESTS.json](../../frontend/test-results/consumer-ui-20261108/qa-r4/HOOK-TESTS.json)，jsdom：捕获坐标恢复、同卡重建、目标移除/虚拟化、无opener、不夺新动作、期限、scope改变。开发33/33及其余history/type/build/prerender结果仅作精确输入下的支持证据复用。
- 第二页加载48卡，桌面8681、手机13685，三种关闭保持卡ID集合及位置；第一页之外的懒加载仍发生，无重新抓全部商品。迟到路径最终分别保留H1和用户搜索INPUT，未写旧坐标。
- 已实际看本轮桌面/手机首页开前/关后及手机第二页像素，[VISUAL-REVIEW.json](../../frontend/test-results/consumer-ui-20261108/qa-r4/VISUAL-REVIEW.json)。截图是合成稀疏列表与真实归档原图，不能代表生产内容。
- 浏览器pageErrors0，服务器写请求尝试0；154次实际静态资源全部hash匹配。单测和浏览器是本轮新增，历史通过项按下表复用，不虚增测试数。图片404、私有只读预览/异步同卡等前轮真实浏览器子例保留，通用返回交叉由本轮hook及最小浏览器路径覆盖；未重新跑七项全套。

## D1–D13 当前裁定

| ID | 状态 | 依据与范围 |
|---|---|---|
| D1 | PASS（复用） | 详情/图库/自然比例/字体及售价参考价排版源未改；原桌面手机图像和布局有效，本轮恢复位置像素已看。 |
| D2 | PASS（新增+复用） | 六条可用返回现闭合，照片关闭按钮/品名Escape及无opener/移除目标均有本轮GUI；公开来源真实移除、404 alt、首页/商品两模式、共用私有预览沿原独立证据复用，后台来源保留。 |
| D3 | PASS（新增+复用） | 桌面手机全屏→inline→卡片两级Escape和browser-back通过；原手势、自然滚动、原尺寸拖动/键盘证据复用；正确可见焦点由本轮严格判定。 |
| D4 | PASS（新增+复用） | 六条滚动及第二页重复关闭闭合；当前背景列表保持、显式切期/直接链接/URL、scope期限/新动作晚返均通过；前轮错ID、快速换node、409等有效子例复用。 |
| D5 | PASS（复用） | 日本首尾日、未知/冲突/券期间、同金额不同渠道/单位、实际报价门禁沿R2独立GUI和服务/单元边界；相关源码/JAR未变。 |
| D6 | PASS（有限边界复用） | 六角色/同商家所有权与私有只读预览为既有浏览器mock/服务mock证据；不冒称六角色真实账号全部登录。本轮真实登录0。 |
| D7 | PASS（复用） | HomeBrandIntro、导航与SEO/prerender语义源未改；原无JS可抓取、三导航去重、homePath/node/query保留证据有效。 |
| D8 | PASS（复用+真实回读） | R2缺用户/空名/同名不同ID/仅推荐/仅行程GUI矩阵、11项生产服务repository-mock及匿名nodes证据有效；历史署名/归属无写入。 |
| D9 | PASS（真实回读+保全） | 官方图字节、provenance/历史/样本读回、源码/制品匹配；原三轮QA与脏文件哈希保留，真实业务写0。 |
| D10 | NOT_RUN / ACCEPTED_LIMITATION_NON_BLOCKING | 仅实际语音输出/speech viewer未执行；原四语长标题键盘/ARIA/native AX、空目录/重试PASS复用。父委托转述PM接受该能力局限，不追加轮次、改无障碍设置或装软件。DOM/AX不冒称实际读屏。 |
| D11 | PASS（新增+复用） | 本轮请求预算/原DOM/第二页懒加载与无全量商品检查通过；hook无fetch，目录仍一页元数据；既有24/20边界有效。 |
| D12 | PASS（复用，原两P2已关） | 无行程/未加载/报价无效/过期/跨商家/99/竞态/焦点对比原R2有效；Storefront、ReservationAdd及加号CSS未变，不重做真实购物。 |
| D13 | PASS（有限边界复用+真实匿名回读） | 0→1→0为原浏览器mock及18项服务mock；真实匿名API仍全范围28而搜索0、未知商家0不回落。不扩为真实写生命周期或全角色登录。 |

12 PASS、0 FAIL、1非阻断NOT_RUN。没有尚未闭合的本批本地P1/P2。复用是原相同未改实现的有效证据，不是本轮再执行，也不扩大原模拟/匿名只读范围。

## 数据、资源与交付

真实接口只读6次起始及6次结束，响应字节一致；没有真实商品/订单/价格修改、下单付款、登录、凭据读取、生产访问或数据库清理，数据无需恢复。归档原图字节保持。保护scripts/local-test.ps1仍SHA256 `4e8a397f1d819ced5eb6e23d601b005c74a0a94a963547e1ccae2c5099ffb4b9`。原QA60、R2 QA100、R3 QA38个文件均按其原SHA256SUMS核对保持，包括真实FAIL、报告与回执；发布/失败/恢复证据未改。

本轮Edge所有隔离context/browser和unit workers均已结束；无Java helper、后台测试服务或在途命令。原七容器原身份继续running，不停止用户既有栈。唯一根归还协调方。本轮无正式auto-review拒绝；D10是已接受验证能力边界。

交付：[QA-RECEIPT.json](../../frontend/test-results/consumer-ui-20261108/qa-r4/QA-RECEIPT.json)、[SHA256SUMS.json](../../frontend/test-results/consumer-ui-20261108/qa-r4/SHA256SUMS.json)。回执含本报告、源码/制品/证据SHA，SHA清单覆盖本轮文件与报告。

后续门禁：将精确候选形成可审核提交，跑该提交的新CI/CodeQL/依赖安全，绑定本批完整core+web制品及适用受控发布审核。R4 JAR未变不能漏掉本整批原有后端读投影。当前只有本地制品绑定；旧fc57 CI不可代替新候选检查。生产操作本轮未执行，既有20261107.1/fc57+V27接受记录保持，未宣告该UI上线。
