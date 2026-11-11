# Product card unification

## 最终交付，2026-11-11

本批三项要求全部完成并已在生产运行。代码已合并远端 main；Core 为 `b8b7158`，前端为 `8bfb479` 的同一已验收制品。最后一次 Core 写入于 11:43:31 UTC 恢复，V32 无新迁移，切换期间业务指纹一致，受保护基础设施及 DR 未变。后续提交只补验收文档，不改变运行制品。

| 用户要求 | 最终判定 | 有效证据 |
| --- | --- | --- |
| 好物推荐与本程好物使用相同精简格式 | PASS | 两页、首页、单期、历史及客户预览采用共享商品卡片；保留图片、品牌、最多两行名称、编号、评分及一个价格区，完整条件在详情。最终两页 1440/390/360 原始视口与局部见下方索引。 |
| 大字价格、同行等高及评分 | PASS | 正常金额 24/28px，极长金额完整单行缩字，后续行独立定高；无评分固定五颗灰星。生产参考价保留窗口状态，缺可靠售价保持价格待确认。真实详情来源金额、九档评分入口与列表返回已核对；用户评分和均分逻辑保持原验收规则。 |
| 整体加载优化 | PASS | 初始 JS gzip 从 644333 降到 415617 字节，减少 35.5%。同条件目录暖读为 1329/1042/753ms，中位数从 1863ms 降至 1042ms，约快 44%。浏览器禁缓存首排两图全部完成从 4956ms 降到 2637ms；四秒预算通过。记录请求时间戳，服务端/CDN未重置。 |

正式前端 114 个文件、757 项全通过。最终后端 660 项中 636 通过、24 条件跳过，零失败，配置的覆盖率门禁通过。相关权限 9 条正反例、真实 PostgreSQL 投影和 HTTP 通过。前端制品未变，图片补充批次复用有效前端证据。最终原尺寸窄屏字形四边余量至少 4/7/14/14px；品牌占位 18px，同行标题起点差 0.016px；初始标题离固定页头 57.875px，目录按钮与标题中心差 0。Gemini 建议与主 Agent 排查分别保留，最终功能、几何和视觉均为 PASS。

最后一次发布连续 601.7 秒、14 次健康采样通过，Core 与前端零重启，主页、目录、评分接口均 200，79 个前端文件和 Core JAR 精确匹配。健康期后已清理被替换的 Core 20261111.3；此前本批旧 Core 20261111.2、旧前端 20261111.1 及临时归档已清理。没有停止的旧回滚容器。当前运行前端 20261111.3、Core 20261111.4、数据库备份保留，未执行全局 prune。

最终完整运行图、原尺寸局部、逐页矩阵、绑定、速度及健康回执：[最终证据索引](evidence/image-read-20261111/README.md)。截图为真实生产数据；极长价、两个用户均分及编辑预览等合成数据已明确限定为本地隔离环境。下面按时间保留旧阶段的失效结论及修复过程，当前交付以本节和最终原始视口证据为准。


## 下一版纠正批次，用户生产反馈，2026-11-11

### 冷图片性能补充批次

20261111.3 已于 2026-11-11 11:08:52 UTC 切换并开放写入，业务指纹不变，V32 无迁移，601.8 秒 14 次健康采样通过且零重启。生产两页和单期的 1440/390/360 格式、灰星、大字价格均通过实际检查。目录三次暖读 1235/1139/910ms，中位数较原 1863ms 降低约 39%，首屏 JS gzip 减少 35.5%。

整批交付继续保持未完成：禁用浏览器缓存时目录 API 850ms，首排两图全部完成 4956ms，图片请求 TTFB 为 2738/3729ms。源码发现 `RecommendationService.image` 在存在软删除商品时，每图重复 materialize 全部商品及全部推荐实体，包含与权限判断无关的完整多语资料和发布快照。新增有界补充只将该判断改为读取原算法使用的商品图集、商品 ID、推荐图片 URL 和图集；完整 URL 精确比较、PUBLIC 范围、软删除拒绝与共享有效引用规则保持一致。禁止增加权限缓存、通配 URL 匹配、价格推断或迁移。验证覆盖四类允许、拒绝及空引用边界和实际数据库投影；正式前端 757 结果与已通过 UI 制品原样复用，补跑受影响后端门禁、精确 Core JAR，再生产 Core 单次前向更新和冷图测速。相关性能 PASS 待新证据。

Gemini 对长截图屏外白图提出疑点，滚动到对应四张图后，实际 naturalWidth 均大于零且加载完成，属于懒加载；图片加载后的原图保留。其标题对齐疑点由 18px 品牌占位及相同标题实际起点消除。未知价格少一行导致的底部余白符合同行等高约束。

补充批次本地完成：9 条图片权限正反例通过，正式后端 660 项中 636 通过、24 条件跳过、零失败，覆盖率门禁通过。真实 PostgreSQL `bobuy_cards_20261111` 存在 3 个软删除商品，标量图集和推荐 URL/图集投影在实际 Core HTTP 调用通过；68 字节的任务专用合成 PNG 返回 200。首次进程预热在并行全量测试负载下 5099ms，随后两次 29/26ms，原始值全部保留，禁止将其当作生产冷加载结果。生产发布前在写保护中预热图片权限查询。无数据迁移，原同版本前端资源与 757 项测试复用，下一步只更新 Core 并测真实公网冷缓存。

20261111.3 健康观察通过后，已于 11:31:49 UTC 删除无运行引用的旧 Core 20261111.2、旧前端 20261111.1 两个镜像及 5620435 字节的本批临时前端归档。运行容器、启动时间、重启数均不变，数据库备份保留。此次图片修复发布后再按同一 10 分钟预算观察，随后只清理被替换的 Core 20261111.3；当前运行的前端 20261111.3 保留。

用户实看生产后判定不合格，撤销本次页面及总体视觉验收 PASS。新增三项兼容纠正：好物推荐卡片移除过量文字，手机布局简洁；与本程好物完全一致的卡片格式，两页均展示大字单行价格；整体加载过慢，须测量并优化。此前本地几何、单元测试通过的事实保留，其结果不能替代本批真实生产页面视觉和速度验收。

当前生产事实：20261111.1 完成 V28.1 至 V32 的单次升级，公开参考商品评分修复 `0cf8fe1` 随 20261111.2 更新 Core，前端仍为 `eb43b48`。修复后公开评分接口返回 200。648 项后端正式测试中 624 项通过、24 项条件跳过、零失败，配置的 JaCoCo 门禁通过。随后 602 秒、14 次连续健康采样通过且零重启，按用户授权清理本批 4 个旧镜像标签及 466422272 字节临时镜像归档；运行容器未变，数据库备份保留。此事实不改变下一版页面验收未通过的状态。

速度与视觉验收预算：复用现有 3px 字形内边距、44px 手机热区、6px 操作间距和居中容差；商品图正方形、品牌一行、名称最多两行、编号一行、评分一行、单一价格区，商品卡片不承载规格段落、优惠日期长段或发布人页脚。正常金额保持 24 至 28px，超长金额完整单行缩字。管理客户预览同步使用同一商品卡片，详情保留完整事实。实测原生产首屏两个目录接口约 6.9 秒、节点约 7.3 秒；同一 390px 浏览器三次暖读本程好物分别 1419、1863、2477ms，中位数 1863ms。优化后同条件三次暖读目标为中位数不超过 1200ms、单次不超过 2000ms；冷读另记录，目标不超过 4000ms；首屏 JS 压缩体积相较原公开页面实际依赖图减少至少 20%。测量保留完整请求时序和输入版本，不能用缓存热读冒充冷读。

来源价格边界：生产“双面毛巾”公开详情只记录优惠 400 日元，原价及折后价均未知。该项应显示价格待确认，保留详情中的优惠事实；完整售价或有来源参考价才显示金额。浏览卡片新增受限的来源参考价摘要，保留原期次、条目和窗口状态，不把折扣金额或商家私有成本作为公开售价。

前端正式全量首轮 757 项中 748 通过、9 失败。失效输入为旧模拟目录缺少 markedScopeTotal、零标记仍预期两请求、路由测试依赖已删期次页脚、详情条件测试依赖已删卡片优惠段。修复仅更新模拟合同和可见入口，保留相同商品跨分区、分页独立、陈旧响应隔离、精确返回 URL 和详情全部优惠条件断言。专项回归先恢复正确行为，再冻结测试输入执行正式全量；超时保持原值。首次全量期间补充的服务通栏 CSS 只影响运行视觉，已重建并撤销此前推荐截图，最终以 final 后缀证据为准。后端正式全量及覆盖门禁通过，源码未变化，复用该结果。

本批实际手机截图发现悬浮期数按钮盖住超长金额，相关视觉项保持 FAIL。将入口归入标题行共同操作区，保留 48px 热区、12px 间距及按需抽屉，重新核对原失败金额区域，避免操作层遮挡价格。

独立建议链路：当前目录最高 Claude Opus 两次请求均无可用账户，按规则降级至正式 `deepseek-flash` 文本建议。主 Agent 已复核其建议，拒绝不存在的来源字段假设、按最低价挑选和保留商品长页脚的部分；采用共享卡片、受限价格摘要及零标记免重复请求。实际优化继续复用既有发布可见性与逐次读取，不使用跨请求 TTL 掩盖隐私/价格变化。版本编译依赖确认支持 Rollup `onlyExplicitManualChunks`，避免共用依赖被后台页面手工分包拖入公开首屏。

方法与边界：先完成已经通过专项和正式后端门禁的公开参考商品评分修复，随后集中实现上述页面与加载批次。两个页面共享同一精简商品卡片；实际售价和有来源的参考价保留清晰语义，禁止把未知金额或参考价冒充实际售价。用真实运行接口耗时、资源体积、首屏呈现和图片请求瀑布定位瓶颈，再作最小相关优化。保留现有美术、同行等高、两行名称、完整单行缩字金额、灰星和用户评分规则，保护商品身份、原价格事实和私有资料。

完成标准：桌面 1440、手机 390 和最窄 360 的两页正常/长名/长价/未知价状态格式一致、简洁可读，真实整体图及原尺寸局部通过主 Agent 和 Gemini 复核；记录相同视口与数据的优化前后耗时，检查控制台、网络、分页、筛选、详情返回和评分交互。生产反馈实例加入负例，任何缺失或失败保持未通过。修复统一验证、合并发布并重新观察健康后，按授权清理本批无运行引用的旧镜像/回滚容器。

### 本批本地冻结与发布评估

本地功能、几何、视觉已逐项复核。当前目录、当前推荐、历史展开、单期、首页和客户预览均使用共享商品卡片；1440/390/360 真实截图及 browser-matrix 保留。同一商品首次实际售价 980，参考价 1234，极限来源金额 999999999999.99，缺价格与缺图保持未知；本地 demo-milk 改为仅来源公开的 DRAFTER_ONLY，未改生产数据。首页 24+9 分页实际加载 33 条内容，包含 32 商品、1 服务，详情开关及返回保留列表。灰星和 2 人平均 4.25、九档分布已在运行页核对，控制台无警告或错误。

正式前端 114 个文件、757 项全通过。后端 651 项中 627 通过、24 条件跳过、零失败，JaCoCo 配置门禁通过。TypeScript、1607 项语言资源、生产构建通过，源文件和依赖哈希绑定 accepted-gates、source-inputs、artifact-manifest。源代码冻结后仅补充文档、截图及发布工具。共享读取优化保留发布快照、商品身份和逐期来源，不引入 TTL 缓存或读写兼容层。

Gemini 独立复核见 gemini-review.txt，图像请求最高 Pro 两次上游失败，最新高能力 Flash 图片最小请求成功后执行复核。其品牌标题对齐疑点已用实际 DOM 和同像素截图复核：缺品牌占位 18px，两张卡片标题起点完全相同。参考价说明单独占一行，保留来源语义，其金额行与无说明售价行不强制齐平。名称与价格为左对齐文本角色，名称按钮字形四边至少 3px；目录入口 48px 热区，标题间距 12px，像素字形中心及安全距离见 actual-glyph-metrics.json。原尺寸局部和完整页均保留，最终判断由主 Agent 作出。

发布范围仅 Core 和前端，V32 无数据库迁移，新鲜备份及原业务表指纹守卫继续保留。新 operator 核对现运行 0cf8fe1 Core 与 eb43b48 前端、精确 JAR/前端文件/镜像层、受保护容器及 DR 状态；失败只回滚应用，禁止数据库旧快照覆盖。公网页面、三次暖读和独立冷读、10 分钟健康观察及本批旧资源清理仍待生产完成，整批交付状态保持未完成。

## 合并与生产发布续办，2026-11-11

用户已明确授权将本批提交合并主分支并发布生产。实现候选为 `eb43b4868fa214f8dc68feb39ab083bf7b3df42e`，远端主分支当前为 `8ae465a3752af68da23e407bb8379f31a45aa2aa`，两者是直接祖先关系。继续在本任务独立工作树操作，原工作区无关改动全部保留。

后续纠正：应用代码一次升级到最终候选，只切换一套 Core 和前端。V28.2 至 V32 是 Flyway 顺序执行的数据库迁移编号，首次启动一次应用全部待执行脚本；不逐版部署中间应用。远端 main 已快进到 `eb43b48`。恢复镜像单独保留，正常路径不运行该镜像。

用户追加授权：生产持续健康后无需保留本次旧镜像/回滚容器。执行预算为发布后连续观察 10 分钟，健康检查、关键公开接口、页面及版本持续正常后，清理本次替换的旧 Core、旧前端及本次应急 Core 镜像的无运行引用标签和已停止回滚容器。只处理明确绑定本批的资源；运行镜像、基础设施、其他项目和数据库备份保留。共享层由 Docker 依赖管理，不全局 prune。

生产验收修复批次：首次切换后服务健康及业务数据保存通过，实际公开目录的参考商品评分接口返回 404。根因为评分权限只承认可售 PUBLIC 商品，目录还合法展示同商家已发布推荐关联的 DRAFTER_ONLY 参考商品。撤销该功能及总体发布验收 PASS，修复范围仅为评分可见性和参考商品均分投影。复用现有推荐发布判定，保留未发布、跨商家、私有及删除商品隔离；不更改商品售价/可售状态，不迁移或改写生产内容。新增真实失败类别与负例测试，相关后端正式门禁后更新 Core，前端资源保持通过的版本；观察计时从修复验收成功重新开始。

方法：先核实际生产版本、迁移和发布 operator；复用匹配输入的本地全量、迁移及逐页证据；核实主分支相对生产的完整待发布范围、恢复包及受保护服务；冻结版本和制品后运行必要发布门禁，再执行备份、写入隔离、迁移与切换；最后验证公网版本、API、桌面/手机页面、控制台、网络及截图。项目 CI 定义已在既有主分支移除，不能假定 Hosted CI 会自动提供构建制品。

完成标准：远端 main 包含本批提交；生产运行对应的 Core 与前端制品，数据库达到 V32；既有业务数据保存、受保护服务不变，评分与卡片页面通过公网验收。停止写入期间可按已验证快照恢复；写入重新开放后使用兼容应用包或前向修复，禁止旧快照覆盖新业务写入。发现缺失门禁时保持未发布状态并补齐，不将缺证据判为通过。

Goal: apply the existing product card presentation rules to every active product card surface, including public catalog, recommendations, merchant preview, recommendation editor and product records.

## 最终验收结果，2026-11-11

C2 样式收尾已完成：C1 分页截图暴露窄屏双滚动条，原状态视觉结论已撤销。评价 CSS 现锁定背景页滚动、限制弹窗内容高度，并让分页操作占满内容列。已用 390×844、360×800 的首屏及底部原图重新验收，分页按钮 44px，字形中心误差 0.219px，四边余量至少 15.28px；外层滚动尺寸与视口完全一致。21 条合成评价通过 20+1 分页全部呈现，加载完成后按钮消失。资料已从本地复制库清理，原示例仍为 2 人、均分 4.25。独立 Gemini 复核与主 Agent 最终视觉判断均为 PASS。见 [分页 API](evidence/unified-cards/review-pagination-api.json)、[字形](evidence/unified-cards/user-reviews-b2-final/pagination-glyph-metrics.json)、[外框滚动边界](evidence/unified-cards/user-reviews-b2-final/pagination-scroll-boundary.json)、[复核](evidence/unified-cards/user-reviews-b2-final/gemini-pagination-final.txt)。

本地产品功能、几何和视觉验收均为 PASS。候选位于 `codex/unified-product-cards-20261111`，基线为 `8ae465a`。本次完成代码、迁移、本地运行和逐页验收；生产发布不在本次范围。

最终规则：每行内卡片等高，各行按内容独立计算高度；商品名最多两行；货币符号与金额同行，常规金额保持 24–28px，过长金额按实际可用宽度自动缩小并完整保持单行；简化卡片实际售价区，保留单位和参考价说明。无公开均分时保留五颗灰星占位。用户提供的失败截图保存在 [原始纠正样例](evidence/unified-cards/user-correction-row-height.png)。先前全网格等高和价格换行结论均已撤销。

用户评分已替换商家手动评分。客户和采购员均可为公开商品提交 1 至 5 分、每档 0.5 分的评分及选填文字评价，每个用户对每个商品保留一条可修改记录。展示当前评分算术平均值；鼠标悬停、手机点击和键盘 Enter 可展开九档分布。示例两位用户分别为 4 和 4.5 分，均值为 4.25，卡片显示 4.3，两档各 1 人。作者身份来自登录态；公开列表只返回评分、正文、时间和评价记录 ID。

### 逐页矩阵

下列 PASS 均包含实际浏览器检查、对应截图、同行边界和金额完整性检查。桌面视口为 1440×900，手机为 390×844，最窄视口为 360×800。所有数据为本地合成验收数据。

| 页面或状态 | 桌面 | 手机 | 最窄视口 |
| --- | --- | --- | --- |
| 首页商品推荐 | [PASS](evidence/unified-cards/user-reviews-b2-final/home-desktop.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/home-mobile.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/home-narrow.jpg) |
| 本程好物 | [PASS](evidence/unified-cards/user-reviews-b2-final/catalog-desktop.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/catalog-mobile.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/catalog-narrow.jpg) |
| 标记商品及同页全部商品 | [PASS](evidence/unified-cards/user-reviews-b2-final/marked-1440.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/marked-390.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/marked-360.jpg) |
| 当前推荐 | [PASS](evidence/unified-cards/user-reviews-b2-final/recommendations-desktop.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/recommendations-mobile.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/recommendations-narrow.jpg) |
| 展开历史推荐 | [PASS](evidence/unified-cards/user-reviews-b2-final/history-desktop.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/history-mobile.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/history-narrow.jpg) |
| 当前单期 | [PASS](evidence/unified-cards/user-reviews-b2-final/issue-desktop.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/issue-mobile.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/issue-narrow.jpg) |
| 历史单期 | [PASS](evidence/unified-cards/user-reviews-b2-final/historical-issue-desktop.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/historical-issue-mobile.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/historical-issue-narrow.jpg) |
| 商品档案图片卡片 | [PASS](evidence/unified-cards/user-reviews-b2-final/records-desktop.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/records-mobile.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/records-narrow.jpg) |
| 紧凑管理商品卡片 | 桌面为既有表格，卡片项 N/A | [PASS](evidence/unified-cards/user-reviews-b2-final/stock-mobile.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/stock-narrow.jpg) |
| 推荐编辑商品卡片 | [PASS](evidence/unified-cards/user-reviews-b2-final/editor-desktop.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/editor-mobile.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/editor-narrow.jpg) |
| 客户效果预览 | [桌面 PASS](evidence/unified-cards/user-reviews-b2-final/preview-desktop.jpg)，[手机模式 PASS](evidence/unified-cards/user-reviews-b2-final/preview-desktop-phone-mode.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/preview-mobile.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/preview-360.jpg) |
| 已删除商品恢复清单 | [表格 PASS](evidence/unified-cards/user-reviews-b2-final/trash-desktop.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/trash-mobile.jpg) | [PASS](evidence/unified-cards/user-reviews-b2-final/trash-narrow.jpg) |

恢复清单保留原有业务字段，其金额和评分项为 N/A。服务活动没有商品身份，其用户评分项为 N/A，已有服务报价采用同一单行金额组件。购物车、订单明细行及供应商卡片沿用各自业务布局。`ProductFeed`、`ClientHomeV2` 没有活动路由引用，已单独排除。

### 验证与版本绑定

功能：后端正式运行 644 项，622 项通过、22 项按条件跳过，失败和错误均为零，项目配置的 JaCoCo 门禁通过。另以真实 Java 17 Core 和 PostgreSQL 验证客户/采购员权限、九个分值、作者归属、匿名拒绝、版本冲突、并发创建/修改、均值和分布一致性、隐私字段及私有/删除商品隔离，见 [API 证据](evidence/unified-cards/user-review-api.json) 和 [后端门禁](evidence/unified-cards/backend-gate.log)。

迁移：V32 新建用户评价表，并保留旧商家评分表作审计记录，运行逻辑已移除旧评分读写。迁移前后 43 个既有表的数据和列结构指纹一致，新评价表初始为空，见 [迁移证据](evidence/unified-cards/user-review-migration.json)。PostgreSQL 直接约束拒绝越界值和非半分值，包括 1.04；产品行锁和评价版本检查保证并发只有一个写入成功。

前端：最终正式全量 113 个文件、750 项测试全部通过，失败为零，5 秒超时阈值保持原值，见 [正式结果](evidence/unified-cards/frontend-c1-suite.json) 和 [运行日志](evidence/unified-cards/frontend-c1-formal.log)。此前日期测试在完整运行触及超时，现将无关评分叶组件隔离，111 条资料和全部日期、草稿、身份及版本断言保留。评分本身另有组件及真实接口测试。34 项相关测试、TypeScript、1602 项 i18n 资源检查和最终构建均通过。

版本绑定：最终全量冻结 278 个前端输入；后续仅增加三个评价弹窗 CSS 规则，校验器按实际 LF 字节反向还原确认，全部 TypeScript 输入与正式运行完全一致。该 CSS 变更执行构建、真实浏览器、手机与桌面表单原尺寸字形复验；保留 [C1 编译记录](evidence/unified-cards/frontend-c1-build.json) 与 [C2 构建日志](evidence/unified-cards/frontend-c2-build.log)。509 个后端输入完全一致。见 [最终源码清单](evidence/unified-cards/user-reviews-b2-final/source-manifest.json)、[构建产物清单](evidence/unified-cards/user-reviews-b2-final/artifact-manifest.json) 和 [实际加载资源绑定](evidence/unified-cards/user-reviews-b2-final/loaded-asset-binding.json)。

几何：43 次页面状态观测覆盖 182 行和 187 次金额渲染。同行底边差不超过 1px；各行独立、无横向溢出；金额全部单行且文本完整。手机示例的长金额行高 406.86px，下一普通行高 370.72px，独立减少 36.14px；长金额缩为 17.3px，普通金额保留 24px。见 [机械核对结果](evidence/unified-cards/user-reviews-b2-final/mechanical-result.json) 和 [逐项几何数据](evidence/unified-cards/user-reviews-b2-final/page-geometry.json)。

原尺寸字形：使用 Chrome 原始 PNG，分别为 1440×900 与 390×844，等待 Modal 入场动画类移除后绑定控件坐标。八个评分表单控件和四个档案操作控件均通过原定预算：字形余量至少 3px，居中偏差不超过 min(2px, 字形高度的 10%)，手机主操作热区至少 44px，档案操作间距 6px，推荐编辑操作间距 8px。见 [评分字形](evidence/unified-cards/user-reviews-b2-final/native-glyph-metrics.json) 和 [档案字形](evidence/unified-cards/user-reviews-b2-final/native-record-glyph-metrics.json)。早期工具导出缩放和动画中的截图已退出最终判定。

浏览器：逐页批次记录 239 个响应，C1 记录 100 个，C2 最终记录 62 个，均成功且无加载失败，对应控制台 error/warn 均为零。见 [逐页网络](evidence/unified-cards/user-reviews-b2-final/browser-network.json)、[最终网络](evidence/unified-cards/user-reviews-b2-final/c2-browser-network.json) 和 [最终控制台](evidence/unified-cards/user-reviews-b2-final/c2-browser-console.json)。长时间验收期间本地登录令牌曾到期，已通过正常登录界面刷新会话，随后重新起始 C2 网络记录；该诊断阶段不计入成功网络区间。客户和采购员均通过真实界面保存并刷新读回；编辑保持评价人数不变。悬停、手机点击、键盘 Enter、Modal 关闭、预览设备切换、管理视图切换、历史展开和详情返回均已核对。

视觉：主 Agent 已检查整体运行图及原尺寸局部。Gemini Pro 图片请求不可用，当前目录中已实际验证的 `gemini-3.8-flash-high` 完成独立复核，七项核心视觉标准均通过，见 [独立复核原文](evidence/unified-cards/user-reviews-b2-final/gemini-final-review.txt)。其余疑点逐项处理：未知售价保持明确文字状态；原站半透明顶栏保持原有风格；导出裁边及动画中取图使用稳定后的原始 PNG 替换。最终判定由主 Agent 独立承担。

推荐核对的实拍：[桌面整体](evidence/unified-cards/user-reviews-b2-final/catalog-desktop-native.png)、[手机完整视口](evidence/unified-cards/user-reviews-b2-final/catalog-mobile-row-comparison-native.png)、[手机价格与行高局部](evidence/unified-cards/user-reviews-b2-final/catalog-mobile-price-detail-native.png)、[评价表单](evidence/unified-cards/user-reviews-b2-final/review-mobile-native.png)、[分布局部](evidence/unified-cards/user-reviews-b2-final/distribution-detail-native.png)、[档案](evidence/unified-cards/user-reviews-b2-final/records-mobile-native.png)、[紧凑管理](evidence/unified-cards/user-reviews-b2-final/stock-mobile-native.png)、[编辑](evidence/unified-cards/user-reviews-b2-final/editor-mobile-native.png)、[预览](evidence/unified-cards/user-reviews-b2-final/preview-mobile-native.png)。

### 本地环境与发布评估

沿用既有本地服务，单独复制数据库 `bobuy_cards_20261111`，没有修改原 V27 本地库或生产数据。Core 监听 `127.0.0.1:18081`，构建版前端监听 `127.0.0.1:5180`。使用已验证的 Node 20.19.0 和任务专属临时目录，修复测试资料签名、资源路径及缺失模拟数据问题。保留用于核对的本地构建与迁移前备份。

生产发布需要配套部署 V32、Core 新接口和前端资源，并按既有发布 operator 执行版本、备份、兼容性及恢复门禁。本次没有生产迁移、远端发布或生产订单写入。已有新写入后，恢复旧快照覆盖数据的方式不适用。

## 执行过程与已被后续纠正覆盖的中间记录

下列为过程记录，最终规则和验收以本页上方为准。旧的全网格等高、金额换行、商家手动评分及未完成结论均已由最终候选替换。

### B2 method and correction record

Follow-up C1 is bounded to completion of verification: the second full frontend run passed 749/750, with the same date-conflict case timing out. Source inspection shows its deliberate 111-item fixture also mounted unrelated new rating widgets against an API mock without the review API. Isolate that leaf rendering in the date suite, retaining all 111-item identity, version, permission and draft assertions and the same timeout. Rating rendering and I/O retain their dedicated tests and real-browser evidence. Also validate the conditional more-reviews state using 21 explicitly synthetic reviews in the copied local database, then remove that fixture. Enforce the same phone target budget if that state exposes a smaller control. No business logic, production data, gateway settings or migration changes are included.

Final exact-candidate frontend run: the earlier full report retained two timeout failures, and the final input adds the scoped optical CSS correction. Freeze all 278 current frontend inputs and run the complete 750-case suite once with two workers while browser acceptance is idle. Assertions and the 5000ms timeout policy stay unchanged. This is the bounded final rerun; backend inputs, migration, native HTTP and coverage evidence remain valid and are reused. Record the final report without overwriting the first run or targeted retest.

The user's screenshot correction supersedes the earlier global equal-height interpretation. Cards are equal height only within each grid row. A long title, unusual amount wrapping, or optional content in one row must not increase any other row's height. Use intrinsic auto grid rows with stretch alignment; retain the existing grid widths and gaps. Single-column management/trash rows size independently as well.

The actual selling-price presentation must be concise and designed: a small currency symbol and large amount share a baseline, with units as quiet supporting text. Remove the repeated actual-price label from compact cards. Keep reference-price labels so promotional reference offers remain distinguishable from actual selling prices. Keep the real currency available in accessible text/title, genuine zero versus unknown, existing artwork/corners and all user-review functionality.

Additional user correction: prices must never wrap, because splitting a number can be misleading. Normal amounts retain the large 24–28px size; when the full formatted price exceeds its actual available width, automatically reduce its font size enough to keep the entire number on one line. Apply this to actual and reference prices. Remove the former numeric-group break markup. Observe width changes and content changes with lifecycle cleanup; verify real font metrics at 1440px, 390px and 360px. Long-price acceptance now requires a single text baseline, the complete unchanged formatted number, no horizontal overflow and automatic shrink; a smaller extreme-price size is explicitly authorized by this correction.

Text-only DeepSeek `deepseek-flash` high advice supplied minimal currency/title and compact-label changes. Main agent accepts those semantics; its retained group-break markup is superseded by the subsequent user no-wrap requirement. Main agent owns the native ResizeObserver fitter, row sizing, tests, code and visual decisions. The fitter resets to the normal CSS size before measuring, shrinks only on overflow, schedules resize work on animation frames and disconnects/cancels on cleanup. No runtime legacy or environment fallback is introduced. The jsdom browser primitive is mocked only in test setup; browser font/resize verification remains mandatory.

B2 verification: 34 related assertions passed, TypeScript and i18n passed, and the built browser shows intrinsic independent row heights with no overflowing or multi-line monetary values. Formal frontend run completed 748/750 passing; two existing issue-date interaction cases hit the unchanged 5-second timeout under four-worker contention. The same complete six-case file reran with one worker and the same default timeout, passing all six in 5.75 seconds total. Reuse the other 744 assertions from the formal run; no assertions, waits or timeouts were weakened. Both JSON reports are retained. Backend inputs remain unchanged.

After the formal run, original pixels showed the centered record text-label glyph 1.10px below its target center against a 1.04px tolerance. The icon centering correction passed. Apply a 0.5px upward optical correction to text-label spans only, keeping icons and hit areas unchanged. The original crop and measured result are retained with the final replacement. This single-selector CSS change requires its build and record glyph/page recheck; the already passed JavaScript behavior evidence remains valid. Do not rerun unrelated backend or frontend behavior gates for this optical adjustment.

All prior card height and price visual acceptance is withdrawn. Reuse unchanged backend, migration, security, user-review persistence and browser interaction evidence. This bounded batch changes the shared money component, compact selling-price markup and applicable grid CSS, plus relevant render tests. Acceptance: at 1440px, 390px and 360px, same-row bottoms match; a deliberately tall maximum-price row does not enlarge a later ordinary row; symbol and first amount line share a baseline; no repeated actual-price label, no clipped/overflowing amount, and gray five-star placeholders remain. Start the real built candidate, inspect every affected active page, console/network, original screenshots and controls; repair and Gemini-review the new visible states. Freeze this batch before its combined tests/build. Production remains untouched.

User clarification: preserve the existing artwork and design style. Unify grid sizing, equal-height cards, two-line product names, emphasized large price numerals and rating presentation. Amounts are the primary price information; labels and units remain small. Ratings now follow the user review system below. This clarification applies to the whole existing task and its desktop/mobile page acceptance.

## User review system requirement correction

The user replaces the merchant-maintained score requirement with a real user review system. Every authenticated user, including customers and purchasing agents, can submit a product score from 1 to 5 in half-point increments and a text review. Product cards display the arithmetic mean of current user scores; hovering the stars shows counts for all nine possible scores. Mobile and keyboard interaction must expose the same distribution.

Implementation defaults: one current review per product and authenticated account, editable by its author; updates do not increase review count. Never trust a submitted author ID. Text is plain text, up to 2000 characters, optional with a score. No purchase prerequisite is inferred. Public summary/list access follows the existing product visibility and deletion policies. No reviews means null average, zero count and an explicit unrated state; zero is not a valid submission. Display the numeric mean rounded to one decimal, while retaining exact aggregate sum/count for computation. Half-star drawing is a visual approximation and must not change the mathematical mean. The distribution includes zero-count bins 1,1.5,2,2.5,3,3.5,4,4.5,5.

Migration: use the next version after V31, preserve the old merchant score data as audit-only legacy provenance, and do not convert it into user-authored reviews or aggregate inputs. Remove old merchant score editing, publicVisible flags and single-score runtime fallbacks after switching all consumers. New review uniqueness and range constraints are enforced in PostgreSQL. Product-row locking plus review version checking must serialize create/update and reject stale edits without partial writes. Summary reads must have consistent sum, count and distribution; avoid per-card review-list requests. Verify customer/agent parity, author ownership, anonymous mutation rejection, private/deleted product access, duplicate create, concurrent update, accurate averages and histograms, escaped text, no-review state and migration preservation.

This correction invalidates the prior merchant-rating acceptance and its review fixtures. Card layout evidence remains reusable only where rendering inputs are unchanged. The user review system has now been implemented and verified against a copied local PostgreSQL database. Final page acceptance is recorded below; historical continuation notes are not current acceptance claims.

Design advisory: current model-validating Claude request returned no available accounts; DeepSeek `deepseek-flash` high supplied text-only advice. Main review accepts exact numeric half-point constraints, a unique product/user key, short product-locked versioned writes and a single grouped query for coherent aggregate/histogram. Generic suggested table IDs, cascade deletion and runtime privilege changes are not adopted; repository product IDs are strings and existing retention/security rules govern them. This advisory is not implementation or test evidence.

Preserve the real price, publication state and existing operations. Establish user-authored reviews and aggregate ratings as specified above. Do not infer ratings or alter production data. Work against main `8ae465a` in this isolated checkout. Earlier merchant-score implementation notes below are historical and superseded for rating acceptance.

Use equal grid rows, a two-line title, prominent price amounts and small labels and units. At desktop and mobile widths inspect overall layout and every changed region, interactions, console and network; test long names, maximum price, optional fields and publication states. Record failures and missing evidence. Budgets: at least 3px glyph inset, center error at most min(2px, 10% of glyph height), 6px between adjacent action targets and at least 44px height for primary mobile actions.

Complete code, update the documented requirements, run focused checks and the applicable final gate, then review each page and evidence. No deployment is authorized by this task.

## Current acceptance

Current continuation scope: finish actual desktop/mobile acceptance for every active product card route, retain existing artwork, validate large prices, equal rows, two-line names and user review averages. All rating renderers use the new user review endpoints. Reuse the isolated database and local services. Capture final candidate, console/network, interactions and final crops; repair discovered defects before acceptance.

### Final candidate checks and responsive correction

Backend formal gate passed 644 tests (622 passed, 22 conditionally skipped), zero failures/errors, with generated JaCoCo data and all configured coverage checks passing. Real Java 17 Core and PostgreSQL HTTP/concurrency checks supplement conditional test skips. Frontend formal run passed 113 files and 749 tests on Node 20.19.0. TypeScript, 1602-key i18n validation and production build passed. Existing vendor bundle size warning remains.

At the final built-page review, narrow 360px cards and the nested mobile preview exposed inconsistent rating row heights when the unrated label wrapped. This invalidates narrow rating visual evidence only. The bounded correction stacks stars and their numeric/unrated label consistently in those narrow contexts, retaining font sizes, colors and artwork. Rebuild, focused component checks and fresh screenshots are required; backend inputs and frontend behavior tests are unchanged. Budget remains 44px minimum target height, 3px glyph inset, 6px target separation, and the original centering tolerance.

User correction during acceptance: unrated products always retain five gray stars as a permanent layout placeholder. This behavior already exists in the shared renderer and applies to public, editor, preview, gallery and compact cards, including products without a public review identity. No fabricated score of zero is shown. Keep this state in the final visual regression list.

Make the five empty stars explicitly muted gray (#b9b9b2) rather than relying on AntD's very faint default. Strengthen the existing unrated-state regression to require five empty stars. This changes presentation and the relevant assertion only; repeat the focused rating/price checks and final build, and capture fresh unrated states across the page inventory.

Desktop preview device switching revealed an additional real defect: the old device rule targeted the removed masonry class, so the new grid rendered a single column under the phone toggle. Update that rule to the active grid and apply two columns, 24px amounts, 14px titles/stars and the same fixed rating area in phone mode. This invalidates desktop phone-preview layout evidence. Scope is CSS only; reusing the 749-test behavior gate is valid because JavaScript, tests and dependencies are unchanged. Rebuild and repeat affected preview screenshots and geometry; retain other functional evidence.

Final control-budget inspection found zero padding on the existing transparent product-name buttons. Enforce the original 3px glyph safety budget on these buttons and source links, with 44px minimum title/source targets. This affects public/preview card geometry only. Capture the final public/preview screenshots after this CSS build; records/editor/stock controls retain their existing passed inputs.

Original-pixel action checks found a real record-card defect: the shared marker trigger's start alignment moved its tag icon to the left inside an expanded grid cell. The delete icon also exceeded the predeclared vertical tolerance by 0.09px in the normalized screenshot. Withdraw record action geometry/visual acceptance and center all four record actions with inline flex alignment. Rebuild and remeasure the same controls at the same phone viewport, then capture desktop/390px/360px records. Other renderer behavior and visual evidence is unchanged.

Incomplete. The preview now uses the public grid rules, the recommendation editor uses compact reference prices, and the product gallery has equal-height cards, two-line names and emphasized actual prices. Preview and editor records do not carry a public rating field; no rating was invented. The mobile stock management cards and deleted-product cards were subsequently identified and still require a deliberate scope and implementation review. The preview rating path also requires verification against the public projection.

On the isolated checkout, TypeScript `tsc --noEmit` passed. Five focused Vitest files passed 48 tests; the run emitted duplicate-key and React Router warnings. `git diff --check` passed. These tests do not establish geometry or visual acceptance. The development server started on 127.0.0.1:5179, but the browser showed an internal server error: requests to the local API proxy were refused because the backend was unavailable. Desktop and mobile page screenshots, glyph and control measurements, interactive browser checks, network and console acceptance, and Gemini screenshot review remain uncompleted. No deployment or commit.

The editor retained its offer notes after switching to compact price presentation; its four focused tests passed again after that adjustment. The local development server was stopped. Cleanup of the task's dependency junction was rejected by host policy before execution; the junction remains in this checkout and points to the existing release-test-gate dependencies. The incomplete candidate is intentionally uncommitted.

Continuation: mobile stock cards and trash cards now have two-line names; stock cards use square photos and prominent prices, actions retain 44px targets. Existing local services were restarted. Old backend schema V27 caused missing current APIs. A separate local bobuy_cards_20261111 database copied only existing synthetic fixtures, and the retained main Core JAR migrated it to V31. Candidate frontend now proxies 18081 via environment only. TypeScript and eight related archive/trash tests passed. Full frontend build result pending. Page acceptance remains in progress.

## Continuation evidence

Core JAR SHA256: `9262b19aabe2d4a40c1c370a654af7aff2fe78cbb73c5e1c81fbe675b9309374`. Local container `bobuy-cards-core-20261111` listens only on 127.0.0.1:18081 and uses the isolated database. Development frontend 127.0.0.1:5179 proxies it via process environment. Existing local V27 database was not migrated by the candidate. New SQL fixtures are limited to this copied database and explicitly synthetic; public fixture snapshots test rendering only and do not establish publication workflow correctness.

Build passed with 1589 i18n keys and the existing vendor size warning. Following image-error handling and mobile grid markup changes, TypeScript and 39 focused tests passed (archive 5, trash 3, navigation 3, history 28). The last button-group CSS change passed diff whitespace checks; a final build has not been rerun. Failed image handling uses a neutral placeholder rather than another product's picture.

Actual screenshots under `evidence/unified-cards`: catalog, issue and records at desktop 1440x900 and mobile 390x844, plus mobile stock, editor and preview, and desktop preview. These screenshots use synthetic data. The preview's three card heights measured 474.328125px at the mobile viewport. This is geometry evidence only. The final mobile record action group changed to two columns with 6px gaps and 44px minimum targets, and `records-390-final.jpg` supersedes the prior mobile record screenshot.

Gemini Pro image review failed upstream. Image-validated Gemini 3.8 Flash high reviewed `preview-mobile-cards.jpg`: it flagged bottom-bar clipping, price visibility, count and truncation. The count and two-line truncation are expected viewport behavior; the screenshot itself is insufficient to resolve the bottom-bar and full-price visibility concerns. They remain open. Main agent has inspected actual screenshots, including full-page mobile issue and record captures, but has not measured actual glyph ink bounds.

Overall acceptance remains incomplete. Missing: populated trash rendering and restore interaction, historical recommendation coverage, rating visibility states across every applicable renderer, full desktop editor and mobile preview device toggle coverage, final same-region crops and actual glyph/target measurements, clean final console/network acceptance, and post-CSS final candidate verification. No commit, push or deployment. Development frontend and isolated Core remain available for continuation. Dependency-junction cleanup remains previously blocked by host policy.

## Latest page acceptance continuation

Merchant product gallery, mobile stock cards, recommendation editor and private preview now render the existing merchant rating endpoint's explicitly public score. Hidden, missing and invalid values remain absent. A missing-product initial-state crash found by StoreNavigation test was fixed. Two meaningful component cases cover public visibility and late responses. The six-file regression batch passed 60 tests; after fixing duplicate sibling keys in writing/intake components, the affected recommendation and navigation suites passed 12 tests. Counts overlap and must not be added. Build passed before the final sibling-key and action-area CSS changes. Whitespace check passed after those changes.

Isolated fixture scripts now cover public 4.5 stars, hidden 3 stars, absent score, maximum reference price and integral JPY sale price, an expired issue, and a dedicated trash product. The temporary sale fixture originally lacked PRE_ORDER eligibility and used fractional JPY; corrected without changing production policy. All writes were to bobuy_cards_20261111. Actual mobile trash restore removed only card-trash-fixture from the trash list. The restored product remains in the copied database. Desktop trash is a table, with no card price/rating fields to invent.

Final-stage captures and DOM observations are in `evidence/unified-cards/final/`. Desktop 1440x900 and mobile 390x844 routes inspected: home, catalog, recommendation browse, issue, product records, recommendation editor, private preview, plus mobile stock cards. Every measured grid had equal outer card heights; title clamps were two, and sale amounts used 24px on mobile. See metrics.json for per-card measurements. This does not establish actual glyph ink or complete visual PASS. Price/rating fixtures changed after the first catalog-mobile.jpg, so that early image and its missing-price findings are superseded by later data, and need a final refreshed screenshot for delivery.

Historical recommendation expand loaded the dedicated expired product. Product detail open/close returned five visible list cards, retaining expanded history. Console revealed duplicate writing/intake sibling keys; prefixes fixed. A final clean console/network capture after this change remains required. Gemini 3.8 Flash reviewed an earlier mobile catalog capture and raised action baseline consistency and screenshot-overlay concerns. The action group now uses margin-top:auto and order11. Its title-height concern conflicts with measured reserved two-line title geometry; this disagreement is not a visual PASS. Final viewport crops, actual glyph bounds/target measurements, a final whole-page visual review including service cards, and the exact final candidate build remain open. No all-pages acceptance or release-readiness claim is made.
