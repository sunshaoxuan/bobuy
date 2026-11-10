# 消费者 UI 七项 — 独立 QA 回执

2026-11-08 UTC。**结论：FAIL / NOT_RELEASED / releaseAccepted=false。发现两个 P2，均已在最终构建资源的桌面和手机浏览器复现。** 本报告接续原独立 QA，使用同一 OHR0067、唯一 `media-upload-fix` 根及原七个容器；未派其他执行者，未改应用源码，未提交/push、部署或访问生产。

## 候选与证据绑定

- 候选 `consumer-ui-20261108-dev1`，未提交，基于 HEAD `fc57d58e773f730158cc827a1c4d221ebce1a594`。
- 原 [SOURCE-MANIFEST](../../frontend/test-results/consumer-ui-20261108/SOURCE-MANIFEST.json) SHA256 `23b19b13ecfbc25aaec647f7461b454d3d5c28b2b5f3b62111ec3ef3f4dc7974`；31 个应用/测试输入的有序摘要 `fd16c0ce0548b5f7fca3f6482820d1facaa7e3125e92bd2bf5489d3b463793b8`，独立重算一致。
- 实际容器 JAR `1ac5d916ca78498e04ffaad0338af38505fde17c455f991cc34aeb8c6cc84a5b`；实际 web index `7b4bea9086e55ead93a7da79553e50dfd2245f1d61f22d0d963a75655141c4b3`。七容器 ID/image 未变。镜像 ID 本身不代表覆盖后的候选。
- 111 个静态源码、配置、制品、测试/失败/发布证据文件哈希匹配。初次严格扫描另外发现 PM PLAN/CHANGELOG 两个交接后文档变化；其 06:36 UTC 追加段落记录开发归还与 QA 指派，原 D1–D13 保留。原 mismatch 保存在 [BINDING.json](../../frontend/test-results/consumer-ui-20261108/qa/BINDING.json)，最终分离文档漂移后的绑定见 [BINDING-FINAL.json](../../frontend/test-results/consumer-ui-20261108/qa/BINDING-FINAL.json)，没有改写开发 manifest。
- 独立 headless Edge 非持久 context 实际加载的 472 次 JS/CSS 资源响应全部匹配最终构建；重复加载不算新增测试数。后台服务夹具使用的两个服务 class 与该 JAR 内 class 逐字节匹配。
- `scripts/local-test.ps1` 保持原脏文件 SHA256 `4e8a397f1d819ced5eb6e23d601b005c74a0a94a963547e1ccae2c5099ffb4b9`。已先检查它和既有测试清理逻辑；未调用 start/stop、数据库清理或带 `deleteAll` 的集成测试。

## P2-01：首页没有可预订行程仍显示加号

位置：[Storefront.tsx:173](../../frontend/src/pages/Storefront.tsx:173)，`canBuyRootProduct` 只检查 trips 已完成及商家与 node/进行中行程匹配，没有要求该商家存在可预订行程。

最小复现：匿名访问 `/?node=883010`；浏览器合成夹具令 active-trips 返回同商家进行中行程，bookable `/api/storefront/trips` 返回 `[]`，有公开商品和有效实际报价，标记全范围为 0。首页进入本程好物模式，1440×900 和 390×844 均显示一个可激活 `.reservation-add`。点击后弹出“暂无可预订行程”，`.trip-choice` 为 0。预期无加号，不能把进行中可浏览范围视为已经开放预订。

此复现没有生成订单或付款；观察到的是资格呈现错误与空前置流程。证据：[GUI-DELTA.json](../../frontend/test-results/consumer-ui-20261108/qa/GUI-DELTA.json) 的 `root-no-bookable-confirm-*`；[桌面](../../frontend/test-results/consumer-ui-20261108/qa/confirmed-no-bookable-1440.png)、[手机](../../frontend/test-results/consumer-ui-20261108/qa/confirmed-no-bookable-390.png)。开发应在原根修正首页资格并补“进行中有、可预订无”的负例；QA 未代改实现。

## P2-02：加号白色图标落在近白色背景上

位置：[consumer-detail.css:21](../../frontend/src/components/consumer-detail.css:21) 与 [browse.css:37](../../frontend/src/browse.css:37)。新按钮设置白色图标和暗色背景；实际加载顺序中，旧 `.storefront .product-add` 以相同 specificity 覆盖背景为 `#ffffffed`，白色前景仍保留。

最小复现：合成公开商品具有有效实际报价与同商家可预订行程，直接访问 `/products?node=883010`。1440×900 和 390×844 上计算样式为：按钮/图标 `rgb(255,255,255)`，背景 `rgba(255,255,255,0.93)`，SVG fill 白色，按钮 44×44。实际像素近乎空白圆钮，无法可靠识别加号。透明背景即使叠在纯黑底上，白色图标与合成后的背景对比仍不足约 1.2:1；浅色商品图上更低。

证据：[GUI-FINAL.json](../../frontend/test-results/consumer-ui-20261108/qa/GUI-FINAL.json) 的 `plus-contrast-*` 和样式记录；[桌面](../../frontend/test-results/consumer-ui-20261108/qa/plus-contrast-1440.png)、[手机](../../frontend/test-results/consumer-ui-20261108/qa/plus-contrast-390.png)。记录中的 `bugs.width` 被同对象的控件宽度覆盖为 `44px`；对应 viewport 以 `checks.width` 和截图文件名为准。需修最终 cascade，并在真实构建加载顺序检查默认/焦点/触屏对比，不能仅凭 CSS 源码声明验收。

## D1–D13 独立裁定

PASS 仅限本表列明且绑定有效的证据。NOT_RUN 表示该 D 项仍有必要子场景缺口，不能把部分通过改称完整通过。开发 78/78 前端、12/12 后端及 type/i18n/SEO/build 的同输入有效回执已复核复用，仍标为开发证据，没有冒充本次独立全量运行。

| ID | 状态 | 独立结果、证据类型及限制 |
|---|---|---|
| D1 | PASS | 最终资源真实 Edge + 归档官方原图/事实的浏览器重放。1440/390/375，同一湿巾的推荐 topic、推荐详情、商品详情两栏/单栏与无横溢出通过。独立查看顶部及滚动到底截图；1518/1848/330、单位和非售价/日期层级可读。商家/列表是合成响应，非生产验收。 |
| D2 | NOT_RUN | 公开推荐两种深链、all/marked 商品详情、桌面/手机管理端私有消费者预览均实测来源 DOM/链接/文件名消失；alt 使用商品名/序号；预览只读。共用 JSX 与后台来源字段保留已审。未独立补故障图片实际加载失败，以及首页两个模式的所有入口变体，不能称完整路径矩阵通过。 |
| D3 | PASS | 独立真实 Edge 键盘边界/选图、进入全屏、双击切原尺寸、原尺寸原生 CDP 拖动不换图、Escape 先关全屏回焦再关详情通过。原生横划/纵向滚动/触屏 pan 的开发 R4 证据在相同手势源 hash 下复用；无图片编辑。不是跨浏览器全兼容结论。 |
| D4 | NOT_RUN | 独立手机 all→详情→后退→前进→刷新→关闭→marked 详情通过，node/query 和 productSection 正确。最后复验 [GUI-STATE.json](../../frontend/test-results/consumer-ui-20261108/qa/GUI-STATE.json) 通过。长分页列表滚动位置、快速重复 node/项切换、完整错 ID/旧响应浏览器矩阵未独立完成；相关组件证据仅复用开发匹配输入。 |
| D5 | NOT_RUN | 原价/参考价/折扣/日期/单位无改写；实际报价缺失无加号、详情禁买，真实加购只改浏览器购物车。有效期到期开发 GUI 与既有日期单测复用。日本首/尾日、不同渠道/单位/同金额不合并、冲突和券期间的完整组合未补独立运行。 |
| D6 | PASS | 六类浏览器本地模拟身份：匿名、CUSTOMER、同商家 AGENT、异商家 AGENT、platformAdmin+CUSTOMER 无 AGENT、双角色；仅同商家含 AGENT 显示标记编辑。无编辑意图不抓管理定义。私有预览真实 UI 为 mock 登录态，禁买，无来源；服务仓储 mock 对匿名/客户/外商家拒绝通过。现有权限代码未改。**没有新真实账号登录，也不声称 mock 证明了完整真实认证部署。** |
| D7 | PASS | 独立桌面/手机 JavaScript 禁用浏览器检查一个 nav、三个可爬链接、H1、canonical、JSON-LD。当前 React 品牌区无重复三链接；homePath/node 选择源码及匹配组件证据复用。未访问生产 robots/sitemap。 |
| D8 | NOT_RUN | 实际本地 nodes API 成功，合成 UI 当前 B/历史 A 分离；源码只对已有公开 merchantIds 批查 User.name，无历史修改。新后端开发两例及前端慢旧名例 hash 匹配。缺用户/空白名/同名/推荐-only/行程-only完整独立组合仍缺，未做任何账号改名。 |
| D9 | PASS | 31 源码/制品绑定、实际合成公开 API 前后字节一致、现存 provenance/gallery 字段保留，三张归档官方原图文件哈希重新核对。未执行 update、迁移、真实内容/价格/订单写命令。并非本次重新核生产数据。 |
| D10 | NOT_RUN | 真实 Edge 右上目录发现、当前后页99号高亮保留、hover 21条/手动更多26条、跨入离开反复、Escape回焦/Tab再开、reduced motion通过；开发1280/1024/390断点与触屏入口证据复用。空/错目录、四语言超长标题和实际辅助读屏软件尚未完整独立走查。 |
| D11 | PASS | 独立后页选择/重复hover/focus没有新增目录请求，下一页只由“更多”触发；只请求指定期正文。首卡ready后单页20条、窄屏显式取数及身份/revision拒绝的匹配源/开发请求回执复用。未启动服务器容量基准。私有预览沿原逻辑显式读取公开 products，和目录预算分开记录。 |
| D12 | FAIL | P2-01、P2-02。其余实测：44px、可访问名称、触屏/Space各加一次、不误开详情、缺实际报价无加号、跨商家确认取消保留原cart。开发到期撤下证据复用。数量99上限和全部卡入口竞态未独立覆盖。 |
| D13 | PASS | 实际本地 API：28个标记，首批24/hasNext；query无匹配时items/scopeTotal为0而markedScopeTotal仍28；未知商家为0且不回退。浏览器模拟持久状态0→保存首标记1→重开→清空最后标记0→刷新，桌面/手机整个分区收回，all编辑入口保留；搜索0有紧凑reset且能恢复。18项生产服务+仓储mock夹具直接验证0→1→0、幂等、旧版本拒绝、datasetRevision与价格保全。开发loading/503/retry/身份迟到组件同输入证据复用。**不称真实PostgreSQL首/末标记写测**；现有商家有28标记，未清空其他商品来造零。 |

## 方法、失败记录与数据恢复

浏览器 API 全部在非持久 context 内拦截，身份凭据值是无效的 browser-local 字符串，并且所有 API 仍被 fixture 接管，未发往实际认证接口。没有借用用户浏览器/session。归档原图来自开发已绑定的官方字节；示例商家883010和商品事实重放边界见原 [ARCHIVED-14110.json](../../frontend/test-results/consumer-ui-20261108/ARCHIVED-14110.json)。实际 API 检查是匿名 localhost 只读，和浏览器 mock 分开保存。

已看原详情、期数目录、零标记截图像素，以及最终桌面/手机详情、底部价格条件、目录、首/末标记和两个失败截图。参考图沿原本机路径使用，未猜URL、重下载或换电脑。原首页重复导航图本轮未另行取回；去重以实际初始HTML、当前UI及差异源码核验。

保留所有失败：首次 audit 把 API receipt 的 path 当文件，修正后发现默认 Docker 沙箱拒绝，改走官方受控只读执行成功；PM文档哈希漂移保留并解释。GUI初版 modal根定位无盒尺寸、选中期标题selector、缺taxonomy fixture、带icon按钮准确名称、保留的隐藏Drawer和双汉字按钮可访问空格都已在验收脚本修正后定向补测；初版唯一 `undefined.map` 来自不完整taxonomy mock，后续页错误为0。这些不列应用缺陷，也未删除失败回执。Java默认沙箱编译卡住，无class；核唯一父子进程后仅停止本任务javac，受控30秒上限重跑成功，[SERVICE-R1.json](../../frontend/test-results/consumer-ui-20261108/qa/SERVICE-R1.json) 为18 PASS，初次 [SERVICE.json](../../frontend/test-results/consumer-ui-20261108/qa/SERVICE.json) 仍在。

本次实际业务写入0、生产调用0、真实登录0，不需要数据库恢复。模拟标记最终空集，模拟cart随context销毁。`qa-m2-001`公开详情、nodes、28条标记及无匹配/未知商家响应在QA开始与结束哈希完全一致；未读取密码或API密钥。原 fc57 的真实UI登录保存/清空/恢复回执 `QA-AUTH-SAVE-R1-RESULT.json` 仅作为历史持久化基线，当前候选未重做真实持久化成功声明。

## 归还与发布门禁

所有本任务浏览器context/进程关闭，Java编译/运行结束；七个原容器保持运行和原身份，唯一根连同失败候选归还协调方，无后续写测或发布在途。QA只新增本报告及 `frontend/test-results/consumer-ui-20261108/qa/` 证据。

下一步由原开发在唯一根修复两个P2，重新绑定受影响源/构建，QA按差异补验；上表NOT_RUN子场景仍需明确补齐或由协调方作范围决策。精确新候选尚未commit，故新CI/CodeQL/依赖门禁 **NOT_RUN**；旧fc57 CI不能覆盖本批。发布制品与受控发布审核均未执行，生产仍是先前验收的20261107.1/fc57。本次没有正式auto-review拒绝；受控只读、浏览器mock和服务fixture执行均成功。
