# #74 加载提示草稿复核 — 2026-11-21

范围：用户要求复核旧草稿#74（c5aa9e09e744985812263b8fd958ea8e3c0481fa）相对当前main c0201b560dc11de37ee37fca314379516cadd50c 的覆盖/替代/缺项。本次不合入旧冲突分支，不生产操作，不关闭或改写原PR。遵守AGENTS、Bobuy交付技能及UI指南§3.7/§8，复用既有分页/可视行/重试PASS。

先调查再决定是否需要应用改动；仅当前商品目录初始、正常、范围请求中、失败重试及现存共享胶囊的状态。复用隔离Spring18080和依赖；Vite只用于精确main源码，无后端重建。自然API用合成商家1000；临时网络延迟/失败仅稳定捕获状态，不作性能结论。390/1440实图，必要320最长文案组件夹具。预算调查15分钟、浏览器15分钟；若需修复再记录对应最小检查，不预跑无关全量。

已核实：#98 fddf94f1与#100 62e04dc7在main落实了浅灰999px消息标签；#182将/products主入口替换为可视行占位及独立重试。旧PR仅改product-feed.css及证据，14px圆环、loading opacity=1不在当前CSS。下一步核对现存入口和实际状态，不以源码差异直接认定缺陷或已完全覆盖。

浏览器夹具修正：桌面20件叶类已全部落在可见+缓冲内，不产生新的范围请求，故桌面请求中状态改用463件合成长搜索，仅续验桌面；390结果复用。邮报第一次网络夹具缺ApiResponse.status导致被当作原始对象，修正响应封装后仅重验该夹具，非应用缺陷。

邮报第二次夹具失败：释放观察器时遍历并追加同一 targets 数组，触发脚本 RangeError。改为快照遍历，仅重验邮报正常/加载/重试；商品页 PASS 不重跑。

## 结论与处置建议

**原商品目录目标已由后继覆盖/新交互取代，不建议继续合入 #74。不是逐字补丁全覆盖。** 原报告明确定位“带计数的公共商品目录 Ant Design Button”，并兼顾旧 ProductFeed；如今 `/` 跳转 `/products`，该路由 `CatalogSection` 固定使用 viewportMode，旧底部分页按钮受 `!viewportMode` 保护。ProductFeed 在当前 Storefront 无路由引用。把旧胶囊重新加回可视行会改变现行交互，没有本批需要修复的证据。

| 原目标/差异 | main 的事实 | 判定 |
| --- | --- | --- |
| 浅灰大圆角、≥44px | #98 `fddf94f15c4dc2a2e9c4e4c63ffa36b916592902` 与 #100 `62e04dc78de65221b95a9792c8b2f69c0121dc26` 落地；现存共享按钮实测 #f3f3f3、999px、44px | 已覆盖 |
| 原商品目录正常/加载/追加 | #182 当前主入口使用可视范围请求、行占位；首轮“正在加载”，后续行占位；旧 .feed-loader 不挂载 | 新交互取代 |
| 失败后继续获取 | BrowseError 独立“重试”按钮44px；失败范围重试后恢复；不需改旧分页逻辑 | 保留且实测通过 |
| 14px CSS 细圆环、loading opacity=1、文字微调 | 当前 CSS 未采用；活动邮报仍实际使用共享按钮，加载 opacity=.65，Ant SVG 图标 | **没有逐项覆盖**，但已不作用于原商品目录入口；不是本批需要把旧方案移回商品页的依据 |
| 焦点/触屏/减少动画 | 当前样式已包含 focus-visible、hover:fine 条件、reduced-motion；旧补丁不能直接覆盖这些后继规则 | 保留 main |

活动邮报的残余差异须单列：正常文字 #626262、加载时整体 .65，截图可见更淡，不能声称其清晰度与旧 PR 相同。该入口不属于原报告定位的商品目录截图，本次没有将其重新设计纳入代码交付。若商家仍要求在活动邮报保留旧细环及更深加载文字，可按当前样式单独修这两点；无需解冲突或搬回整份旧 CSS。

#74 仍 draft/open、head `c5aa9e09e744985812263b8fd958ea8e3c0481fa`、mergeable=false。本次未关闭、评论、改写、合并该 PR。建议由协调者认可上述范围判定后，以“目标被后继覆盖/取代，非补丁逐项等价”关闭归档；本次先保留。**没有需要发布的应用候选，也未操作生产。** 若决定另交付邮报差异，须明确该范围及新候选的合并/上线授权；旧批次发布授权不延伸到本次。

## 精确输入与定位

应用基线 `c0201b560dc11de37ee37fca314379516cadd50c`，审计分支 `audit/loading-pill-pr74-20261121`，无应用/依赖/配置变更。

- `frontend/src/product-feed.css:42`：现存胶囊、loading 继承 Ant 样式。
- `frontend/src/pages/Storefront.tsx:296`：真实 `/products` 路由；305–306：独立邮报入口。
- `frontend/src/pages/PublicProductCatalog.tsx:92`：viewportMode；210：旧非 viewport 按钮。
- `frontend/src/components/ViewportProductGrid.tsx:53`：行占位。
- `frontend/src/pages/RecommendationBrowse.tsx:61`：仍使用共享分页胶囊。
- `docs/ui-ux-guidelines.md` §3.7、§17.7：当前消息标签与可视行规则；没有把14px自绘圆环规定为现行商品页必要控件。

Vite5190直接提供上述精确源码，不以旧生产包冒充新候选。Git blob：product-feed.css=`ec37ed4216b30ef76d6010951528f81efac8c2c6`；PublicProductCatalog=`bec809026b0dbcef48c2fdc005ab9fc5c6459e8e`；ViewportProductGrid=`703a1e11eb4d4575122328e4deda3f1e3f07c365`；RecommendationBrowse=`c4dccd4c383aea51f624f69e380097fca5645eff`。

## 定向实测

复用隔离后端18080/合成商家1000，当前 main 前端5190；邮报使用仅浏览器内网络合成响应，不写数据库。非生产、非性能计时。后端是既有可视行夹具运行物，本次没有重建为完整合批后端；所核对的是当前前端加载状态和已有范围合同，不宣称本次做了后端/真实生产验收。

| 检查 | 结果 |
| --- | --- |
| 商品页390×844叶类 | PASS：首轮、正常6卡、延迟范围行占位、400失败、手动重试恢复；所有阶段feed-loader=0、无横溢出、pageerror=0 |
| 商品页1440×900合成长搜索 | PASS：首轮、正常、延迟范围、失败重试恢复；feed-loader=0、无横溢出、pageerror=0。实际匹配461件，不能将商家463件全量误写为搜索数量 |
| 邮报390/1440 | PASS：正常24/48、真实观察器自动page1、请求中、失败禁用、独立重试page1、48件完成；请求序列0/1/1，无额外页；pageerror=0 |
| 邮报计算外观 | 正常/加载/禁用高44px，radius999px，gap8px；正常opacity1、加载与禁用.65；SVG保留。旋转中的 bounding rect 并非图标固有尺寸，不用15/21px瞬时框断言两端图标大小不同 |
| 代码/CI | 无应用输入变化，不重跑本地单测/构建。复用已接受 #182 的原生44873398095/44873398094全绿，不把旧#74的43191814808当当前main门禁。不新开代码PR或触发无意义CI |

本次只记录 pageerror，不把它泛称完整 Console error 审计。浏览器人为注入400是预期失败证据；没有声称网络零错误。没有新UI改动，因此不追加320px四语/鼠标/焦点/全套视觉、外部模型或性能测试。初始夹具失败与修正保留上文，products.json内1440失败已由products-desktop.json取代，failed-1440.png不是最终通过证据。

命令（仓库根目录，复用现有服务和 Playwright）：

```sh
node docs/reports/evidence/loading-pill-audit-20261121/audit.mjs
node docs/reports/evidence/loading-pill-audit-20261121/audit-desktop.mjs
node docs/reports/evidence/loading-pill-audit-20261121/pill.mjs
git diff --cached --check
```

以上为执行记录，不是要求重复执行；第一个脚本保留旧桌面不足夹具，最终desktop由第二个脚本补齐。

### 最终证据入口

目录：[脚本、JSON与全部截图](evidence/loading-pill-audit-20261121/)。

- 商品手机：[首轮](evidence/loading-pill-audit-20261121/initial-390.png)、[范围请求](evidence/loading-pill-audit-20261121/range-390.png)、[重试](evidence/loading-pill-audit-20261121/retry-390.png)、[重试局部](evidence/loading-pill-audit-20261121/retry-button-390-detail.png)。
- 商品桌面：[范围请求](evidence/loading-pill-audit-20261121/range-1440.png)、[恢复](evidence/loading-pill-audit-20261121/restored-1440.png)、[最终结果](evidence/loading-pill-audit-20261121/products-desktop.json)。
- 邮报：[正常手机](evidence/loading-pill-audit-20261121/pill-normal-390.png)、[加载手机](evidence/loading-pill-audit-20261121/pill-loading-390.png)、[原尺寸局部](evidence/loading-pill-audit-20261121/pill-loading-390-detail.png)、[桌面](evidence/loading-pill-audit-20261121/pill-loading-1440.png)、[计算结果与请求](evidence/loading-pill-audit-20261121/pill.json)。

证据仅文档交付，不附带生产发布；保留现有后端/依赖与其他任务进程。验收已满足即停止，无需延长原预算做无关回归。
