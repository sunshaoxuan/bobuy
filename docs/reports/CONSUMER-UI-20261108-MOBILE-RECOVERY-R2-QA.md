# 手机恢复R2：独立窄验接受

**本地源码候选接受；发布适配器轻量部分接受。** 原`P2-MIXED-CORE-REVISION`关闭，R1滚动证据HOLD解除，D4恢复PASS。可归还main进入精确提交/正常CI/新web制品绑定及新增维护模板原生nginx验证；本报告不是上线或制品已经接受的声明，不增加PM批准轮。

## 精确输入

`mobile-recovery-r2/HANDOFF.json` SHA256 `ff2e87fe57d3843cbaff879bf982f2b713c63dd5eecba4b5bef4e098c6b7e562`。649个输入独立逐字节匹配，源码摘要`869889956fb81d1ed2a85cb3a2bd6bd5fa71e3011bce7c53dad016a06c0de194`，manifest SHA256 `d525fccf4536f0b35befb80ced9cc316f567e309aef75f2f43858fc1ee1a29f8`。HEAD仍782，尚有未提交差异，不把旧782 web当作新候选。

对照R1仅两个应用文件改变：`browse-pages.css`的推荐卡片图片占位/contain；`issue-directory.css`的hidden显示优先级。TS/本地化/依赖/后端/迁移输入未改。9个受保护文件及41份开发交接证据hash均匹配；原QA报告、回执、624/111失败、后续0记录和生产安全回退材料不覆盖。

实际适配器canonical和R2冻结副本同为`f7fc64cf50e1caf487a1ae48d0ae725aedfca291756cb3e3d9fa3cc846d7f232`。canonical仍放在`mobile-recovery-r1/production_v27_update.candidate.py`，原306失败版本已冻结在R2的`production_v27_update.before.py`；原f71正式适配器保持不变。候选入口仍UNBOUND，未运行真实发布入口。

## 原P2关闭：实际调用链而非只测helper

独立`OPERATOR-REPLAY.json` **19/19 PASS**，用此前已审查的内存文件、OS/FD、进程、SQL、时钟及导入替身，执行精确AST加载的`prepare → inputs/verify_gates/verify_images → update → OperationGuard.compose_up/observe → 实际ready → payload/schema → reopen/recover`。

- 合法782 core、新web的完整正向流程通过，实际ready调用分别收到782与合成未来SOURCE的revision，实际运行身份也分别保持各自值。新`image_binding`已在镜像核验、真正Compose pending赋值、真正update就绪调用三个原失败消费者执行，不是孤立helper测试。
- 错core/web revision、tag、coreSource、加载摘要，以及artifact字节篡改均在服务变更前拒绝。运行core JAR/web文件错误触发应用回退；恢复ready使用既有fc57身份。
- 未知容器、Compose被外部改变均保持现场、API关闭，不覆盖或自动重开。完整结构漂移进入人工恢复状态，仍不重开；有界SQL/操作期限错误停止前向动作，恢复使用独立预算，跳过未改旧应用。sealed输入及描述符释放、严格payload/schema/reopen防护均保留。
- 同一独立夹具重新加载旧306适配器，仍在原`verify_images`路径报`Loaded immutable image identity differs`、无服务操作；`OPERATOR-OLD-CONTROL.json`保留这个期望失败。新版本同输入走通，原P2实际关闭。

未来SOURCE=`999…`、CI/QA/备份和制品元数据仅为标记清楚的**内存夹具**，不是真实发布接受回执；所有真实Docker/SSH/SQL/网络/进程/memfd调用为0。未改产品代码或放宽身份/期限/数据断言。

首轮16PASS/3FAIL保留在`OPERATOR-REPLAY-R0.json`：旧执行器用英文维护提示文字判断开关，新增四语模板已替换该文字，导致把实际503配置误记OPEN。只修QA替身为读取`return 503`语义，仍严格要求未知/漂移时CLOSED且API及整页有两个503，再得19/19；不是产品缺陷被隐藏。未调用旧开发result/PASS映射，独立裁定依据实际phase、配置、身份、ready参数与操作记录。

## 滚动历史与根因闭合

`HISTORY-RECONCILIATION.json`独立读取原始事件、布局和图片记录：

| 历史证据 | 裁定 |
| --- | --- |
| 桌面624 | 3116.2ms时旧locator前基准Y0；3155.3ms真正pointerdown已Y624；文档目标top一直1037.78125，关闭后仍Y624。624发生在输入之前；该原FAIL保留为测量问题，实际恢复没有624偏差。 |
| 手机目录 | 93.796875px目录＋18px margin在详情中变成display:none/高度0，目标文档top实际移动−111.796875px。属于真实布局问题。新`display:block!important`只在hidden目录上保留空间，visibility:hidden及交互抑制保持。 |
| 只修目录后的图片 | 原保留失败仍有112/266px返回差、266.515625px文档位移。7:241/243/244图片complete仍false时naturalHeight从0到1200、渲染高0到155，证明图片头迟到即可撑高。新推荐卡片平方占位与object-fit:contain稳定帧，原图内容自然比例且不裁切。 |

原QA111px没有同等图片事件时间线，无法声称唯一还原当时交错；因此没有把全部手机失败称为测量错误。已证明的两个布局机制均有修改与独立受控重放，足以关闭本次HOLD。

## 新增真实浏览器窄验

同根唯一Vite、隔离非持久headless Edge，匿名公开GET/HEAD，代理剥离凭据；不使用用户session、不登录/下单/保存。数据及图片是真实公开API。`GUI.json`记录实际加载两份CSS模块hash和请求；这仍是源码Vite运行，不是最终编译web。

| 独立路径 | 实际输入Y → 稳定后Y | 目标矩形top差 | 结果 |
| --- | ---: | ---: | --- |
| 桌面1440选中期，全屏两级Escape | 624 → 624 | 0 | PASS |
| 手机390第二页直接Escape | 10381 → 10381 | 0 | PASS |
| 手机390第二页全屏两级Escape | 10381 → 10381 | 0 | PASS |
| 手机390第二页直接关闭，三张真实图延至关闭后加载 | 10381 → 10381 | 0 | PASS |
| 手机390第二页两级关闭，同样迟到三图 | 10381 → 10381 | 0 | PASS |
| 手机360目录展开/收起/Escape回焦 | 正常显隐、无横向溢出 | — | PASS |

以上**6/6 PASS**，输入以真实pointerdown/keydown为基准；关闭及多个后续采样均小于4px，原URL、正确可见name焦点、目标左右/上下矩形恢复，没有二次跳动。目录详情中不可见，但高度分别保持桌面451.125px、手机93.796875px。展开、收起与回焦也真实执行。

慢图检查仅暂停既有三张公开图的传输，API JSON和图片字节不改，不替换为mock商品；浏览器关闭前释放全部暂停。三张图naturalHeight0/complete=false时帧已155×155，加载成1200×1200后仍155×155，页面目标不动。首屏仍24，第二页实际追加；没有用全取图片、扩大viewport、隐藏右列或滚到卡片来掩盖恢复。所有卡片/图片框在client内，360/390无横向溢出。桌面/手机返回、详情及目录截图已独立逐像素查看，图片内容contain，未拉伸裁图，详情自然比例布局没有被卡片CSS覆盖。

## 有效复用与剩余制品阶段

| D项 | 当前状态与证据边界 |
| --- | --- |
| D1 | PASS，新增占位/contain与桌面手机像素，详情原设计证据复用。 |
| D2 | PASS，R1真实卡片入口、公开来源/返回及原只读预览边界复用，本轮恢复交叉通过。 |
| D3 | PASS，本轮原两级Escape路径和焦点/URL；手势、原尺寸拖动等未改证据复用。 |
| D4 | PASS，本轮事件基准、第二页、慢图、隐藏目录与矩形稳定；历史失败全部保留。 |
| D5 | PASS，原日期/报价/券/冲突边界复用，无事实或价格修改。 |
| D6 | PASS有限边界复用，原模拟角色/服务所有权；无新增实际账号登录。 |
| D7 | PASS复用，品牌/导航/SEO/prerender源未改。新编译制品尚待绑定。 |
| D8 | PASS复用，当前商家名/公开范围/历史署名机制未改。 |
| D9 | PASS源码/交接/保护hash；不声称新web制品已验。 |
| D10 | 实际语音NOT_RUN，原PM已接受的非阻断局限；键盘/ARIA/AX既有证据复用。 |
| D11 | PASS，本轮24首屏/追加请求与未加载图片占位；R1一页目录及预算证据复用。 |
| D12 | PASS，R1 helper5项、原加号资格/99/跨商家/竞态证据复用；无真实购买。 |
| D13 | PASS有限边界复用，原服务/浏览器模拟生命周期，不新增真实标记写入或清库。 |

R1的12组宽度、17项真实本地503四语/手动重试、分类/重要限制/卡片点击，以及79单测/类型/i18n相关不变输入证据复用；没有重新累加为本轮新测。原真实782 Java17探针、原生Compose契约及实际激活/安全回退证据继续有效，不恢复为历史NOT_RUN。

**下一步可由原main直接继续**：精确提交及正常CI/安全检查；新web下载校验、源/制品完整绑定（含maintenance HTML）；按最终字节做新增模板原生nginx语法、UTF8、真实503及恢复验证。782 core仅按实际image/JAR身份复用，不能拿fc57 core替代，未来回执应显式关联coreSource。适配器真实SOURCE/制品常量重绑须核值与最终hash；本轮UNBOUND内存夹具不能作执行输入。

这些制品尚未产出或本轮未实跑，不标FAIL也不提前PASS；不泛加全套应用、后端、语音或新Compose轮次。之后沿已有批准的受控单实例流程fresh核生产/并发与私有一致V27备份，保留全部38表及82799v2、560874v4、28668v4和图库，再真实公网手机/桌面验收；失败仅安全应用回退，不恢复旧DB。

生产版本最后15:01的fc57/V27是main交接事实，本轮没有新SSH运行身份核验或备份。匿名公开读取不证明当前容器版本；本轮生产业务写入、迁移、上传、提交/push/部署为0。

## 资源归还

只新增本QA目录和报告；应用与适配器均未修改。最终输入/保护hash、截图/脚本/结果清单、Vite停止与浏览器释放、唯一根归还UTC及报告SHA见`qa-mobile-recovery-r2/QA-RECEIPT.json`。七容器、Meelok claim及用户前台未操作；无新的正式审批拒绝。全部旧失败和本次QA替身R0保留。
