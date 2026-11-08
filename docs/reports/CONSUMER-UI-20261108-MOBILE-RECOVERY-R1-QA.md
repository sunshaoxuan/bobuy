# 手机恢复 R1：独立窄验

结论：**本批不能进入重发；发布适配器 REJECT，滚动冲突证据 HOLD。** 手机主区宽度、卡片入口、维护提示主体通过。没有提交、部署、Docker/JVM/SSH/SQL调用或真实业务写入。本报告不把旧782前端制品认作本次新候选。

## 精确输入与运行

- 交接 `mobile-recovery-r1/HANDOFF.json`：`f0c7f49d50c2a31354f0c9e247d1035e9911133a5d7f2b18fa3ba8c0d2af603d`。
- HEAD `7828194be02d1e1396f304dfd24124a06b35fc32`，另有20个应用文件差异。649个源码/配置输入逐字节吻合；摘要 `024f7293aab887494b72d9b502593090c11d0fd2f42d3a885a15cca7b7dde60d`；源码manifest `469a4395ea4454834e4ea14d58f9d9c76c9d69409c3c1b8b56d02c93569e5ff0`。
- 新适配器 `30637cb8bf7160654a39fc1c40d2bc25685d761be57eda3647cca38ba44ca072`，维护HTML `047f2bab3129118ab72085c64979c6e5d0380cfbec53db73fd4eeede79efdfe9`。适配器保持UNBOUND，未执行真实入口。
- 独立 headless Edge，临时非持久context，同一根唯一Vite。Vite只代理匿名公开GET/HEAD并剥离cookie/Authorization；浏览器阻断写请求。真实商品/API/图片来自公开 bobuy.cc；API JSON按哈希存档。维护故障来自同一Vite的本地HTTP503夹具，并非生产维护或假200。
- 运行的是这份源码的Vite变换结果；`GUI.json`记录实际加载的5个相关模块字节hash。**没有新的编译web、精确提交、CI或生产制品接受。** Edge默认headless滚动条行为使390px viewport/client均390，内容358；没有注入裁列、改viewport或宽度补丁来过关。

## 已通过的新增窄验

| 范围 | 独立结果和边界 |
| --- | --- |
| 三推荐入口×360/375/390/1440 | 12/12真实公开数据几何检查通过。手机viewport/client为360/375/390，layout与primary分别328/343/358；最右卡片344/359/374，最右可点目标345/360/375，document宽等于client、scrollX=0。桌面primary812、含目录layout1136，卡片最右1084。每卡和每按钮矩形完整保留，未只看document宽。 |
| 目录、长品名、分类与追加 | 手机目录首次打开1页元数据、6期、Escape回toggle；桌面hover展开/离开收起。真实长中日品名换行未溢出。首屏仅24项和对应24个报价ID，桌面在首批后加载issues page0；手机未开目录不请求issues。实际追加至48项，并检查其边界；可见底部时允许既有有界懒加载下一页，没有全量请求。三入口360px分别选择实际分类并重置24项，全部通过。 |
| 卡片简化 | 真文字、空白、图片、原生Enter、关闭按钮、Escape、重复关闭、浏览器前后退均已执行。无冗余conditions触发按钮。公开数据无可购买行程，未伪造实际报价或下单；原价格/购买资格证据复用。新helper的5/5独立单测检查native按钮、加号/disabled/管理区域/表单/链接/选中文本不冒泡成详情；这些是组件模拟，不是真实管理员登录。 |
| 图库返回 | 修正隐藏sizer误定位后，手机首页/当前/选中期及桌面首页/当前两级Escape通过；桌面选中期实际pointerdown复验通过。全屏先回inline焦点，再回原卡片。node=1001、query=77839、topic=7的真实数据路径保持URL/焦点/位置，实切到2/3图再两级关闭通过。最新第二页直接Escape实际keydown记录9760→9760，目标7:260矩形也不变。不能用这些覆盖下列冲突记录。 |
| 维护 | 17/17：四语×手机360/桌面1440的应用提示和整页模板，加1条普通503不误判。实际本地503、no-store、整页2703字节hash吻合；四语可读、按钮≥44px、无横向溢出/调试信息/ETA/外部依赖、无自动重试，手动重试恢复真实公开列表。另用真实cart存储结构、本地合成数量2验证503及重试后保留，无服务端订单。 |
| 适配器纯增量 | 6项纯函数/AST检查通过：封印维护HTML同字节消费、篡改先拒绝、未知root/API冻结形态拒绝、显式core来源/禁迁移输入、UNBOUND入口先停止，以及其余生命周期/期限/schema/recovery代码AST保持。**该静态相同不代表混合来源语义仍正确；下面的反例推翻适配器接受。** |

已逐像素查看独立手机/桌面卡片、详情、恢复失败截图及维护提示。图片自然比例、中日名称与参考优惠分层、公共来源隐藏正常；手机两列均存在。最终截图不等于尚不存在的生产编译制品。

## 阻断：P2-MIXED-CORE-REVISION

新适配器允许 `coreSource=7828194…`、新web使用未来SOURCE，但三个消费者仍假设两镜像同SOURCE：

1. `production_v27_update.candidate.py:315`：`verify_images`把core镜像真实revision与新SOURCE比较，合法输入报`Loaded immutable image identity differs`，在prepare输入阶段即拒绝。
2. `:281`：`OperationGuard.compose_up`前向pending revision仍设新SOURCE。若上项单独修好，合法新建的782 core容器会被`:239`判未知，保持现场关闭。
3. `:418`：`r2.ready`仍向core传新SOURCE，合法core无法满足就绪身份契约。

独立 `mixed_source_audit.py`只AST提取相关方法，以内存inspect/snapshot替身和合成未来40位SOURCE重放：元数据准入PASS，镜像核验FAIL、实际observer方法FAIL，就绪契约AST审查FAIL。真实Docker/网络/SSH/SQL调用0；完整输入、替身调用及异常见`MIXED-SOURCE-AUDIT.json`。这三个失败属于同一P2，不能计为三个无关问题。

最小后继：由原开发统一让各镜像身份消费者使用已验该镜像revision，保留严格tag/ID/layers、已知身份和回退保护；core继续真实标记782，不能把旧JAR/镜像重署为新提交。仅补这三消费者的正反内存契约后交还QA，不需要重跑应用全套。

## 滚动证据冲突，尚未闭合

原始自动化与失败截图全部保留：

- `GUI.json`中的4条图库等待失败是误选`aria-hidden` sizer；592px copy失败在locator自动滚动前取基准。修正可见slide定位、先滚动实际copy目标后，相关路径通过；这是QA测量修正，没有放宽4px断言。
- `GUI-SUPPLEMENT.json`仍有桌面选中期两级返回624px、手机第二页直接关闭111px偏差。后者记录按Enter前scrollY9296，关闭稳定后9407；正确7:260 name焦点仍可见，但矩形top376.703→532.219。截图`FAIL-page2-deep-scroll-return.png`。
- `RETURN-TRACE.json`以实际pointerdown/keydown记录的两路径后续均0px；`FINAL-NARROW.json`又独立直接关闭第二页，实际keydown9760，多个稳定采样均9760，目标矩形相同。该后续通过不能证明先前111px一定是测量错误；原两条没有同等事件时间/图片完成追踪，不能排除晚图重排或焦点滚动时序。

因此D4保留**HOLD/冲突未解释**，不以反复重试直到绿色替代闭合，也不宣称已经确认应用根因。最小后继是在原`browser-supplement.mjs`两条失败入口对照现有事件trace，收敛到实际输入前坐标与图片重排/焦点时序；只复核这两条，不重测七项或再开测试栈。若确认原采样无效，需给可审计差异；若为真实漂移，保留严格恢复要求修复。

## D项、复用与未验

| 项 | 本轮裁定 |
| --- | --- |
| D1 | PASS，新增手机/桌面像素和几何；未变图库与事实排版证据复用。 |
| D2 | PASS（新增入口与有效返回子例＋复用公开来源/404/共用预览边界）；滚动整体接受受D4 HOLD限制。 |
| D3 | PASS（两级Escape、焦点和切图新增＋原手势/原尺寸拖动复用），并保留上述选中期冲突。 |
| D4 | HOLD，出现624/111px与后续0px冲突，未宣告全通过。 |
| D5 | PASS复用；后端/事实/价格语义未改，公开API当前japanDay真实为2026-11-09，不把已过窗口说成可买。 |
| D6 | PASS有限边界复用：原授权模拟角色/服务所有权，不是新增实际账号登录。 |
| D7 | PASS复用：品牌/SEO/prerender去重源未改，不把新编译SEO制品说成已验。 |
| D8 | PASS复用：商家当前名/历史署名/公开范围机制未改。 |
| D9 | PASS输入/公开只读数据与保护hash；新web制品仍NOT_RUN。 |
| D10 | 实际语音NOT_RUN，为原PM已接受的非阻断局限；原键盘/ARIA/AX复用，无新读屏轮次。 |
| D11 | PASS新增有界首屏/目录/分类/追加请求证据＋未变协议复用。 |
| D12 | PASS，原加号资格/99/跨商家/竞态独立证据复用，新helper5组件用例通过；本轮没有真实购买或管理员写入。 |
| D13 | PASS有限边界复用：原模拟/服务夹具0→1→0，不新增真实标记保存或清库。 |

原R4及其真实失败均保留。782精确Java17 core探针和原生Compose契约已在12:47真实通过，12:54实际切换后因手机故障于13:09:55回退；已回读并校验对应server-evidence。这些不是本轮新执行，也不再沿用历史“只静态、core/Compose未跑”的过时状态。生产15:01仍fc57/V27来自main交接，本轮没有新SSH/运行身份读取，匿名公开GET不证明最新容器版本。

剩余最小门禁：修复上述适配器P2、解释D4冲突；随后精确提交/CI安全检查、新web下载与源码/全部文件绑定（含新增maintenance HTML）、原生nginx语法及HTTP503/UTF8/恢复检查。原生新模板NOT_RUN；最终制品尚无，不能以Vite代替。已验同一782 core/Compose可按身份复用，不泛加全后端/全套UI重跑。正式发布时沿原受控流程重新核生产状态与鲜活私有V27一致备份，所有当前38业务表、最新Costco及图库保留，回退应用不恢复旧DB。

## 资源与交付

仅新增本QA目录与本报告。原生产报告/回执、f71发布器、Costco交接与`scripts/local-test.ps1`前后hash核验；最终hash、证据清单及释放UTC见`qa-mobile-recovery-r1/QA-RECEIPT.json`。唯一Vite已停止，loopback返回ECONNREFUSED；所有本次context/browser已关闭，结束前只读元数据未见本次Playwright残留。无后台Python/Node测试或unit worker在途；七容器、用户前台与浏览器未操作。默认sandbox Edge崩溃、跨隔离loopback超时、QA路径/常量提取错误及未重载503夹具的中止结果按执行说明保留，未伪装产品通过；本轮无正式自动审批拒绝。
