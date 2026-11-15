# 后台分类树管理（issue #129 child 3）

## Parker 晚间定稿执行指导（2026-11-15）

本节替代下文早期导入与译名假设。依据 [定稿评论](https://github.com/sunshaoxuan/bobuy/issues/133#issuecomment-6892119516)，继续 PR #150 当前已 rebase 的分支。主目标：运营 CSV 表头及两种分隔符、三档来源持久化、默认推迟 C 组九件、经审核名称映射契约。保持树管理、选择器、权限及商品数默认排序和人工顺序。禁止生产导入、提交、推送、新 PR、首页改动、#134 浏览、#155 旧分类删除及并行注册/SMTP 工作。

方法与冻结路径：局部调整导入 service/parser/controller、Product 来源字段及新增幂等迁移；导入页、四语词条、分类名称解析的直接消费者；新增空的待审核名称资源和加载器；相应测试与分类文档。先核对现有契约，再集中实现、快速定向验证、冻结与验收。实际 463 条路径及其翻译依赖 Parker 提供 CSV，本批不生成真实分类，不抓取官网。

逐项验收：两种分隔符及旧表头均可用，来源与原路径留审计；九件及自定义延期名单不写分类或商品字段，仍保持原公开状态；映射仅消费完整审核记录，日文原名保留、缺译名不冒充正式译名。UI 提供四语延期输入及说明，修改输入撤销预览。确认仅写已匹配行。

最小验证冻结：CategoryPathImportServiceTest、名称映射契约测试和新增 migration 的重复执行测试，预计 2 至 5 分钟；CategoryPathImport.test.tsx 与受影响名称解析测试、typecheck、i18n，预计 1 至 3 分钟；本地 Vite 真实页面配合合成 API，双视口 390×844 / 1280×800、四语、console/network、预览及确认与输入失效检查，预计 5 至 10 分钟。复用依赖及现有工具，不启 Docker、不跑全产品测试。通过即交付，失败记录失效输入及最小重跑范围。

UI 预算沿用本文件既有预算与 §8 标准验收条款：新输入复用 Ant Design，热区至少 44px，组间至少 6px，字形内框余量至少 3px；多行说明左对齐自然换行。功能、几何、视觉独立记录。最新证据将记录于本节，旧证据仅在对应输入未变时适用。

本批廉价前检：diff whitespace 与 1866 四语 key PASS。定向前端 12 项与 typecheck PASS。后端首次 27 项中 25 PASS，两项新测试因 Mockito 嵌套设桩及可变参数引用断言失败；只修测试，运行 `-Dtest=CategoryPathImportServiceTest#formerPendingSkusHaveNoSpecialTreatmentAndUnknownSourcesCannotWrite+reviewedNamesAreConsumedOnlyAtConfirmationWithoutChangingPathIdentity test -q`，复用其他 25 项与前端 PASS。外部 Claude 返回无可用账户，DeepSeek 文本建议已复核，采用原文保护、延期替换语义、别名隔离及完整路径审核契约；没有交付项目写权限。

浏览器首轮定位命中 Ant Design 隐藏的测量行，尚未获得截图与完整交互结果；仅改验收脚本为可见数据行，继续原双视口/四语清单，不改变产品代码或重跑单测。

双视口/四语浏览器功能及 console/network PASS 后，截图发现新增来源列使手机日文结果列逐字换行，视觉暂不通过。仅为表格各列设置固定宽度及横向滚动总宽；该输入只使表格截图/几何失效，补拍四语与桌面表格，不重跑已通过的交互、后端和单测。两项失败后端测试修正后 PASS，合计 27 项有效 PASS。

列宽修正后 typecheck PASS；表格源列处在横向滚动中段，先前左右两端截图未覆盖完整来源/状态列，因此仅补该滚动位置的局部图（browser.mjs --columns-only），复用已通过功能和输入框几何。

Gemini 3.1 Pro 图片请求 upstream_error；gemini-3.8-flash-high 最小图片请求成功并完成复核。其指出默认 SKU 换行断开及勾选热区疑点：默认值增加逗号后的空格，确认标签显式 min-height 44px。仅重跑导入页 default-nine 方法及双视口/四语相关截图与热区；其他单测、后端、typecheck 与 i18n 复用。其模板按钮不足 44px 的截图估计被实际 44px 几何否定；表格文字裁切疑点由横向滚动来源/结果/原因局部图确认完整可读。

最终范围复核发现新商品来源字段需要与已有导入备注同样限制为 JSON 只读，防止普通商品更新伪造来源。仅补只读注解与序列化/反序列化负例，执行 CategoryReviewedNamesTest#productSourceIsReadableButCannotBeForgedByProductUpdateJson；已有导入和 UI 行为证据继续适用。

最终确认态旧截图仍含修正前列宽，因此用 --confirmed-only 进入相同合成确认态并替换双视口截图，仅更新失效视觉材料。

### 晚间定稿最终验收

基线 `4c5daa9c`，改动保留工作树，未 commit/push/新建 PR/生产导入。首页、商城浏览、旧分类删除、并行注册/SMTP 均无改动。

| 必需项 | 结果与证据 |
| --- | --- |
| CSV/XLSX 表头别名、半角/全角/混合分隔符、三来源、原文、备注、模板、预览/确认/审计/导出 | PASS，CategoryPathImportServiceTest 23 项有效结果；首次 21 PASS，两项测试夹具修正后单独 PASS |
| 默认九件、自定义/空名单、同身份别名阻断、延期零写入、原公开状态保留、原待核 SKU 正常匹配 | PASS，同一导入服务测试；确认只处理 MATCHED，来源与备注独立保存，其他业务字段无写入 |
| 待审名称文件、完整路径映射、三语与审核凭据验证、日文保留、未审核不消费、商品来源 JSON 防伪 | PASS，CategoryReviewedNamesTest 5 项有效结果（首次四项及新增 JSON 单项） |
| V43 幂等加法迁移、旧分类/价格/公开状态保留 | PASS，H2 PostgreSQL mode 实际执行两次；没有生产 PostgreSQL 验证 |
| 四语延期 UI、输入撤销预览、明确确认、展示名契约 | PASS，两个 Vitest 文件共 12 项；默认文本空格修正后仅重跑对应一项 PASS，其余 11 项复用 |
| 静态检查 | PASS，TypeScript noEmit、1866 个四语 key、git diff --check；无 sandbox/esbuild 阻断 |
| 浏览器功能 | PASS，真实本地 Vite /admin/category-path-import，Chromium，1280×800 与 390×844、四语合成 API；默认名单、来源/延期、修改失效、显式确认，console/pageerror/requestfailed 均为空 |
| 几何 | PASS，最终输入 918×66 / 324×66px；勾选标签与按钮至少 44px，输入字形内框余量最小 12px（左）、16.06px（手机右）、16.5px（上）、14.5px（手机下）；多行输入左上对齐，无居中预算；页面宽度等于视口宽度，表格内部滚动 |
| 视觉 | PASS，主 Agent 查看最终桌面/手机整体、四语延期输入、来源/结果/原因原尺寸局部及确认图。修正手机日文结果逐字换行和默认编号断行；其余整体沿用已有工作台样式 |
| 运营数据准备 | 本批契约完成；463 条真实映射等待 Parker 的 CSV 与运营审核，未编造、未抓取、未导入生产 |

证据：[issue133-evening](reports/evidence/issue133-evening/)。`browser-results.json` 保存功能证据，`visual-results.json` 保存最终输入/勾选区域几何；`*-preview.png`、`*-confirmed.png` 为最终整体图，`*-defer-detail.png` 为原尺寸输入局部，`*-sources-detail.png` / `*-outcomes-detail.png` 为表格滚动位置局部。后两类在仅增加默认值空格与勾选热区之前拍摄，表格输入不变，继续有效。测试与外部意见摘要见 [验收记录](reports/evidence/issue133-evening/acceptance.md)。

交付后续仅为运营 CSV 到达后的名称生成与审核、Parker 后台 dry-run/确认；本批已停止追加检查。清理本次四个临时编辑脚本，保留正式证据和已有依赖/编译缓存，停止本次 5183 Vite 进程。

## Parker 增量执行指导（2026-11-15）

依据 issue #133 comment 6891216111，本批仅补同级商品数默认排序、人工顺序保留，以及可选导入标记的解析、预览、确认、审计、退回和模板。沿用现有树管理、选择器、权限与中文表头。禁止修改商城浏览、抓取分类、操作其他分支、生产、提交、推送或创建 PR。

方法：核对既有实现；增加排序来源和商品标记的版本化幂等迁移；实现两项增量并补对应前后端测试；冻结候选后合并执行定向验证。商品总数、价格、库存和公开状态保持不变，改名及移动保留稳定商品归属。

本批路径与直接消费者：CategoryTreeNode、CategoryTreeManagementService、Product 的标记字段、CategoryPathCsvParser、CategoryPathImportService/Controller、V42 migration、CategoryPathImport 页面/四语词条，以及上述服务和管理/导入页面测试、本文和 category-path-import.md。树管理和选择器复用服务返回的有效 sortOrder，不重做组件。

最小验证：两个服务测试和 V42 迁移检查（预计 2 至 5 分钟）；两个前端页面测试、typecheck/i18n（1 至 3 分钟）；本地真实页面搭配合成 API 数据检查排序、三类标记、确认/导出、console/network，以及 1280×800 和 390×844 截图（5 至 10 分钟）。复用既有依赖，不启动 Docker 栈。测试通过即交付；失败只修复受影响输入，记录最小重跑范围。

验收预算沿用下文 UI/UX §8 标准验收条款及 UI 预算：既有按钮布局保持，新增标记列按原始文本换行，表格可内部横向滚动，页面不可横向溢出。功能、几何及视觉分别记录；截图与外部意见均以合成数据注明。

本批冻结后检查：前端管理/导入 12 项、typecheck、1855 个 i18n key 检查 PASS。后端首次命令在测试启动前因 mvnd 附带 Maven 缺失 MavenCli 失败；失效输入为 Maven 安装路径，改用本机已有完整 Maven 3.9.9，仅运行原定两个服务与迁移测试，保留前端 PASS。

截图审查：预览图完整；确认后的全页截图在页面滚动状态下捕获，固定页眉落在图片中段，不能作为完整构图证据。仅补拍从页首开始的确认截图、手机表格向右滚动的标记/原因局部，以及其他三语窄屏说明。代码、28 项后端、12 项前端及浏览器功能结果继续有效，不重复测试。

### Parker 增量最终验收

| 必需项 | 结果与证据 |
| --- | --- |
| 同级子树商品数默认排序、并列稳定、人工顺序保留、新增与移动继承目标组模式 | PASS，CategoryTreeManagementServiceTest 10 项，含原有稳定商品归属保护 |
| CSV/XLSX 可选表头、推定、最接近路径、自定义原文、待核退回、别名冲突阻断、重复导入 | PASS，CategoryPathImportServiceTest 16 项；确认前后商品数量、价格、库存、公开状态不变；原文审计和商品字段持久化；两列表与空标记保留原标记 |
| V42 幂等及旧顺序保留 | PASS，CategoryTreeMigrationContractTest 2 项；实际执行 V42 两次，验证新行默认值与旧值保留；H2 PostgreSQL 模式，未运行真实 PostgreSQL |
| 管理与导入界面 | PASS，两个 Vitest 文件 12 项；商品数有效位置展示、人工顺序刷新、三类标记预览/确认/退回下载 |
| 静态检查 | PASS，TypeScript noEmit、1855 个四语 key、git diff --check；已有依赖直接复用，无 esbuild/vitest sandbox 阻断 |
| 浏览器功能 | PASS，真实 Vite 工作台页面、Chromium 1280×800 与 390×844、合成 API；排序、标记、确认、导出；console/pageerror/requestfailed 为空 |
| 几何 | PASS，页面宽度分别为 1280 / 390，表格内部横向滚动；可见按钮高 44px。新增标记为左对齐非交互文本，无居中/热区变更，单元格四边 padding 16px；最终字体水平 ink 余量最小左 16px、右 17.47px；文字行框垂直余量最小上 17px、下 19.42px，行框值单独记录，未声称它是实际字形垂直边界 |
| 视觉 | PASS，主 Agent 查看桌面/手机整体及原尺寸表格局部，四语说明均可换行；手机右侧列通过内部滚动完整可读，整体构图沿用现有页面。未改树管理布局或控件样式 |

命令：backend 下 Maven 3.9.9 / 本机 JDK 22，`-Dtest=CategoryTreeManagementServiceTest,CategoryPathImportServiceTest,CategoryTreeMigrationContractTest test -q`；frontend 下 `npm test -- --run src/pages/CategoryTreeManagement.test.tsx src/pages/CategoryPathImport.test.tsx`、`npm run typecheck`、`npm run check:i18n`。只运行本批相关检查，无全项目测试、构建、Docker 栈或线上操作。

证据：[issue133-parker](reports/evidence/issue133-parker/)，含三个后端测试摘要、browser-results.json、visual-results.json、双视口预览/确认及原尺寸局部图。`1280-en-US-confirmed.png` 和 `390-en-US-confirmed.png` 为修正拍摄滚动位置后的完整图；其他三语为 `390-<locale>-confirmed.png`，右侧局部为 `*-flags-right-detail.png`。早期固定页眉错位图片已删除，原功能结果保留。复现脚本保留为正式验收材料；既有依赖和编译缓存保持，停止本次 Vite 进程。

Gemini 独立来源：`gemini-3.1-pro-high` 图片请求 upstream_error；实时目录中的 `gemini-3.8-flash` 最小图片请求成功，随后复核三张实际截图，未发现溢出或裁切，判定本次增量 PASS。其提出中文全页与英文右侧局部的语言来源疑点：两图确为不同 locale 的独立会话，已查看中文右侧局部确认表头和状态为中文；服务端 reason 继续沿用既有原始原因文本展示方式。

完成边界：改动仅留当前工作树，未提交、推送、开 PR 或部署。真实 PostgreSQL / 线上验收未执行；本次交付为本地验证完成。旧排序来源缺失的保留规则已明确披露。既有树管理、选择器、授权逻辑与 `/products` 源码未修改。

## 本次执行指导（2026-11-15，issue #133）

目标：替换初始 stub，完成分类管理、商品单一路径选择和同批中文导入表头及下载模板。仅修改这些功能的直接消费者、四语资源、测试和本文及相关规范；不改商城浏览，不抓取分类，不操作生产，不提交或推送。

步骤：核对模型和权限；实现事务内排序、移动与安全删除、明确未归类归属；完成可访问按钮和叶节点选择；补齐中文表头及模板；冻结候选并合并运行针对性检查；记录实际验收结果。

验证冻结范围：CategoryTreeManagementService、CategoryPathImportService 及解析器、分类 API 权限、CategoryTreeManagement、CategoryTreePicker、ProductMaster 路径保存和导入页，附对应测试与四语资源。后端仅运行相关 service / security 测试；前端仅运行上述组件测试、typecheck 和 i18n 检查。预计后端 2 至 5 分钟、前端 1 至 3 分钟、浏览器 5 至 10 分钟。通过即停止；失败仅修复并复测失效输入对应检查。

UI 预算：390×844 与 1280×800；移动操作至少 44px，操作间距至少 6px，文字距可用内框至少 3px，视觉中心误差不超过 min(2px, 字形高度 10%)。完整路径允许换行；管理操作按行归组。使用真实本地页面与合成数据，记录功能、几何和视觉各自结论。

验证修复记录：首次前端测试遇到 jsdom 24 无法解析 Ant Design TreeSelect 的 `:has` CSS。组件单测使用窄范围 TreeSelect 替身检查数据与回调契约，真实选择、键盘及弹层交互交给 Chromium；仅重跑受影响的三个组件测试，导入测试通过后复用。

后端首次运行：22 项服务/导入/解析测试通过；MVC 权限切片缺少 RequestMetricsService 测试替身导致上下文启动失败。补齐切片依赖后仅重跑 CategoryTreeAuthorizationTest，复用服务测试结果。

权限切片第二次发现主应用显式启用 JPA 导致切片加载仓库；改为显式 MVC 上下文，仅载入实际 SecurityConfig、控制器与 WebConfig，继续只运行权限测试。商品主档仅修改分类时增加直接保存路径分支，受影响 ProductCatalogPanel 测试已在本次 18 项前端组件验证中通过。

浏览器首次夹具遗漏 API 的 status 外层，修正后发现弹窗关闭按钮桌面高度不足 44px，截图还显示弹窗使用全局红色主题及新增主按钮文字对比不足。限定修改分类页/弹窗 CSS，重新验收这些区域；服务与组件功能 PASS 保持有效。

最终检查发现旧导入把日文原名复制到其他 locale，改名后这些副本会残留旧名。改名删除与旧日文相同的继承副本，保留不同的已审核译名；新导入仅写日文原名，并排除系统节点复用。该输入使管理服务和导入服务测试失效，合并重跑这两类及待完成权限测试。权限测试改用真实 AuthCookieService，修复模拟 cookieName 为空的切片启动错误。浏览器桌面树 CRUD 已通过；选择器点击被选中标签遮挡属于自动化定位问题，改用真实键盘 focus/ArrowDown，继续选择器及移动端剩余项。

双视口功能均已走完，移动端测试在删除请求完成前切换页面产生一次主动取消；只补验删除完成等待及网络结果。截图发现导入禁用主按钮对比不足、主档分类可用宽度不足，限定修复禁用样式与分类字段跨列，并移除该主档区域的内部商品 ID。只重新截图受影响的选择器/导入区域及四语长文案；既有管理 CRUD、服务测试继续复用。

最终截图复核：禁用动画后重新获取稳定态截图，避免 Drawer/Select 入场动画被误判布局；TreeSelect 获焦沿用全局红色主题，局部改为工作台金色焦点和中性选中背景，只补拍选择器。

字形检查使用最终字体 Canvas ink bounds 与浏览器逐字 range 定位，操作按钮初始垂直误差 1.5px，单行 13px 字形超出 1.3px 预算；统一上移文字 0.5px，保持背景与热区不变，仅重测树行几何并更新截图。禁用操作文字增强至 #666 / #eee。

## 授权范围与实现选择

### 默认顺序与人工顺序（Parker 增量）

每个同级分组独立排序。未设置人工顺序的组按节点及全部后代的已归属商品总数降序，包含未发布商品；系统未归类节点不进入管理树。同数按保存的创建顺序，再按稳定节点 ID 打破并列。API 的 `sortOrder` 返回当前有效的同级位置，现有管理页和选择器直接复用。

一次上移/下移请求保存整组顺序并标记人工排序，此后商品数变化不改变该组顺序；子组排序不锁定祖先组。新增或移入人工排序组时追加到末尾；移入默认组时按商品数定位。改名不改变排序模式。移动和改名继续使用稳定节点 ID，商品归属、价格、库存及公开状态保持不变。

V42 以 `explicit_order` 区分排序来源。升级前的整数顺序没有来源记录，无法可靠区分自动创建与人工调整，因此迁移保留全部既有顺序。升级后新建分组默认按商品数排序。迁移重复执行不会重置后续默认组或人工顺序。该兼容策略仅用于一次升级的数据来源缺失，不引入长期双读/双写。

外部建议：Claude 最小请求返回无可用账户；`deepseek-flash` 文本建议已复核，采纳分组冻结、确定性并列、缺失标记保留、重复冲突与迁移重复执行测试。其“冻结组中新节点默认自动”的建议与本批保留人工组顺序规则冲突，采用末尾追加。

本批增加后台分类树管理、商品主档的单一主路径选择器及中文表头导入模板，不改变前台 `/products` 浏览，也不导入、抓取或推测 Costco 分类。树管理采用**明确按钮**：新增子节点、改名、移动、上移、下移和删除。文档选择按钮是为了保留清楚的键盘等价操作；当前不提供拖拽。

节点改名和移动保留稳定节点身份，商品的主路径引用因此自动跟随，商品资料、公开状态、价格和库存均不更新。含子节点或商品的节点禁止删除。商品主档选择器显示根到叶的完整可读路径，只保存一个叶节点；允许清空并保持未归类。界面不显示内部 ID、`system_key` 或 `rec-cat-` 代码。

旧分类对照也阻止删除，避免破坏兼容解析。系统未归类节点不进入可编辑列表，服务端拒绝删除、改名、移动和添加子节点。清空保存显式系统归属；仅修改路径时直接调用归属 API，不重写商品主档。未修改路径的普通主档保存不覆盖既有归属。已有节点增加子节点后，原商品引用继续保留；新人工选择仅允许叶节点。

树是共享档案，管理 API 与导入 API 均仅限 AGENT / PLATFORM_ADMIN；商品读取及写入还验证商户归属，平台管理员可跨商户处理。结构修改、归属写入和导入确认在同一永久系统行上加事务锁；一次排序请求在事务中重排同级，移动重写后代祖先 ID 路径。同级日文原名不允许重复，空可选译名会移除并沿用日文原名。

外部 Claude 风险建议已审阅：采用共享事务锁、显式未归类、旧对照删除保护、保留已有非叶引用。其文本路径 LIKE 和自动 Unicode 归一化建议不适用于本项目 JSON ID 数组及逐字匹配契约，未采用。

日文分类名称遵循 `docs/category-tree-data-model.md`：`ja-JP` 保存权威原名；未提供经审核译名的 locale 保留日文原名，不自动翻译或猜测。

## 修改点与最小验证集合

| 修改点 | 最小验证 |
| --- | --- |
| 新增、改名、排序、移动和安全删除服务 | 分类树服务针对性测试 |
| 商品唯一主路径读取与保存 | 商品归属服务测试，确认不更改商品公开状态 |
| 四语树管理和完整路径选择器 | 前端相关组件测试、i18n 检查、typecheck |
| 工作台响应式与可访问操作 | 按 UI/UX §8/§9 在 390×844 和 1280×800 检查改动区域 |

## UI/UX §8 标准验收条款

功能与美观同时验收，须符合 `docs/ui-ux-guidelines.md`：不改变未授权行为；复用工作台 token 和 Ant Design 控件；具备默认、hover、focus-visible、禁用态；桌面密集图标按钮使用规范例外尺寸且移动端触控目标 ≥44px；全部操作有可见标签或 aria-label；四语长文案在 390px 下不溢出；附双视口截图并只运行本批最小测试。

## 最终验收（本地，2026-11-15）

| 验收项 | 结果及证据 |
| --- | --- |
| 新增、改名、一次请求排序、移动、后代完整路径 | PASS，CategoryTreeManagementServiceTest 8 项；包含同级重名、环路、继承日文名称修正 |
| 商品跟随且无商品写入，系统节点保护，非空删除保护 | PASS，同一服务测试验证 product repository 无保存/删除、稳定主路径引用、旧对照保护 |
| 商户和平台权限 | PASS，CategoryTreeAuthorizationTest 实际 SecurityConfig 的 GET/POST/PUT/DELETE 角色矩阵；服务测试验证跨商户拒绝及平台管理员允许 |
| 原路径解析兼容 | PASS，ProductCategoryPathResolverTest 4 项，输入未改变，复用首次结果 |
| 导入中文别名、首行、模板、逐行错误及原有导入行为 | PASS，CategoryPathImportServiceTest 11 项，覆盖 2×3 表头组合的 CSV/XLSX、合成模板下载内容、冲突和幂等 |
| 管理页和路径选择器 | PASS，CategoryTreeManagement.test.tsx 6 项、CategoryTreePicker.test.tsx 5 项、ProductCatalogPanel.test.tsx 7 项 |
| 导入页及路由 | PASS，CategoryPathImport.test.tsx 4 项、CategoryPathImportRoute.test.tsx 4 项 |
| 静态检查 | PASS，npm run typecheck；npm run check:i18n（1840 key）；git diff --check（修复一处尾随空格） |
| 浏览器功能 | PASS，Chromium 1280×800 / 390×844；管理新增、改名、移动、删除，键盘打开操作，真实 TreeSelect 展开，清空并只发送归属写入，模板下载；合成 API 夹具 |
| 布局与视觉 | PASS，工作台真实页面及真实 ProductCatalogPanel 组件预览，完整图与原尺寸局部图见 evidence/issue133；四语树布局无页面横向溢出，改动按钮高度至少 44px，组内间距 8px |

后端共 24 项、前端共 26 项。未执行无关全量、生产部署或真实数据库集成；JPA 事务写锁由实现及服务边界保证，本次数据库行为验证为单元测试和 MVC 权限切片。浏览器数据为本地合成数据，未抓取或写入真实 Costco 分类。

视觉证据位于 [issue133](reports/evidence/issue133/)。最终英文截图为 `1280-tree.png` / `390-tree.png`、`1280-picker.png` / `390-picker.png`、`*-picker-open.png`、`*-import.png`，`*-detail.png` 为原尺寸裁图。其他 locale 的树截图用于文案及换行证据，拍摄于最终禁用文字对比增强之前；布局及文案输入相同。`browser-results.json` 保留最终树行计算样式、热区和最终字体 ink bounds，字形中心最大水平误差约 1.11px、垂直误差 1px，最小边缘余量超过 10px（扣除 1px 边框后），满足预定预算。选择器清空及模板按钮均为 44px 高、999px 圆角、1px 边框、无阴影。

Gemini 来源独立记录：gemini-3.1-pro-high 两次最小图片请求均为 upstream_error；gemini-3.8-flash 最小图片请求成功后完成截图复核。其发现的红色焦点、禁用低对比和截图底部裁切已处理：局部焦点/选中样式、增强禁用文字、滚动至完整控件并关闭截图动画。其关于缺少缩进的推断与实际桌面 16px/移动 6px 树边线及完整路径不符；六按钮组为需求约定，手机换行且热区合格，保留。主 Agent 已查看最终整体及局部图独立验收。

仅有本分支本地未提交改动；没有 commit、push、PR 或部署。保留依赖目录供后续开发，清理本次一次性编辑脚本及浏览器预览入口，正式截图和测试摘要保留在上述 evidence 目录。
