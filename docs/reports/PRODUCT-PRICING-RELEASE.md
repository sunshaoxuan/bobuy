# Scheduled price adjustments — production 20261026.8

Production is activated and verified. Application source: `a3cb1154ff63874ef0b45bd2ee042e138cf8e604`. Exact-candidate [CI 40400709577](https://github.com/sunshaoxuan/bobuy/actions/runs/40400709577) succeeded. The subsequent documentation receipt commit does not change running application bytes.

## Normal UI workflow

Open https://bobuy.cc/admin/stock-master and choose **售价与调价** on a saved product. The panel separates the regular selling quote from adjustment history. Confirm a real regular quote separately when appropriate; create an adjustment draft with amount, JST start/end and an optional internal source note, review it, then explicitly approve. Cancellation retains its history. Saving a draft does not change the effective price.

Intervals are start-inclusive and end-exclusive in JST. Before the start and at/after the end, the existing regular quote applies, subject to its original availability rules. Same-product/channel/currency approved overlaps are rejected with conflict IDs; adjacent intervals are allowed. Approved terms cannot be silently edited. Current channel is STOREFRONT; JPY is enabled for actual sales. Other currency registry entries do not enable sales or convert amounts automatically.

Recommendations, storefront and checkout share the server price resolver. A changed or expired cart quote requires explicit review and refresh. Checkout locks products before choosing its common pricing timestamp, validates the accepted quote fingerprint and stores an exact price snapshot in new order lines. Later price changes do not rewrite completed orders. Costco reference offers remain separate and never automatically create an effective sales adjustment.

## Verification

- Exact-candidate CI: backend 215 tests, 0 failures/errors, 2 existing skips; frontend 120 tests in 38 files; release tools and image build successful. BobbuyStore coverage: lines 589/627 (93.94%), branches 194/253 (76.68%); existing 90/70 gates retained.
- Local targeted checks: pricing/checkout 16 tests, pricing/cart 6, selling-price display 2, publisher guards 9 passed. Integration coverage includes JST boundaries, expiry restoration, adjacent/concurrent overlaps, ownership, stale versions, currency precision, unavailable products, changed-cart rejection and immutable order snapshots.
- Existing shared local fixture, normal visible browser UI: save/reopen, approval, overlap rejection, edit, cancellation, natural expiry to unchanged regular price, desktop and mobile passed. No production administrator credentials were used. Evidence: [local UI](evidence/product-pricing/local-ui.json).
- Production read-only browser: actual desktop/mobile/detail, published data and purchase-state preservation, normal administrator login entry, deployed asset identities and unauthenticated pricing endpoint protection passed. No business writes, orders or payments; Cloudflare telemetry is separately recorded. Evidence: [browser receipt](evidence/product-pricing-production/browser.json).
- CodeQL 40400709720 and automatic dependency scan 40400709419 completed successfully. Scan execution success is not a declaration that existing dependency-risk debt is resolved; dependencies were not upgraded in this batch.

## Migration, data and deployment

V17 adds the independent adjustment table and indexes without updating old rows. The shared local restore probe preserved all 27 preexisting tables and verified the publisher's added-table cleanup plus backup restore. Production backup restoration was also verified before activation.

The fresh production baseline includes the parent's completed normal-UI master reviews. All preexisting columns of eight frozen business tables, including order headers, are unchanged. Both published posts remain 122 + 30 items, 142 products and 142 canonical profiles, with 566 image blobs. Supplier display remains hidden. Confirmed real selling quotes remain 0, production adjustment rows remain 0. No inventory, actual selling price, purchasing activation, registration gate or mail configuration was changed.

All five application services are healthy, frontend is running, restarts are 0 and no OOM was reported. Server release-result binds the running application source to CI 40400709577 and release 20261026.8. Backup is retained at `/opt/bobuy/releases/20261026.8/backup`. Release archive SHA256: `1751d99084deb4e8b0620c000ffaa59d71e0825da064ffbc2f16ed633b7ce3b6`.

Receipts: [release result](evidence/product-pricing-production/release-result.json), [binding](evidence/product-pricing-production/binding.json), [after audit](evidence/product-pricing-production/audit-after.json), [backup check](evidence/product-pricing-production/backup-check.json), [desktop](evidence/product-pricing-production/customer-desktop.png), [mobile](evidence/product-pricing-production/customer-mobile.png), [mobile detail](evidence/product-pricing-production/customer-detail-mobile.png).

No blocker remains for this batch. SMTP authentication remains paused awaiting the previously requested safe login; it is independent of price adjustments. Real selling terms and any effective adjustments still require normal reviewed UI operations by an authorized operator.

## 2026-11-18 纠错候选（PR #162，未发布）

本节为新候选，不延续上文 20261026 的生产验收结论。[计划与执行记录](../plans/product-price-corrections-20261118.md)，[PR #162](https://github.com/sunshaoxuan/bobuy/pull/162)。云端没有修改真实商品、真实传票或生产部署。

### 四项操作说明

1. **取价**：商品售价先满足启用、正金额、有效计价单位、启用币种、PRE_ORDER 和 JST 日期条件，再解析同商品/商家/渠道/币种/单位的已批准传票。当前有效永久单按生效时刻、ID 取最新通常价；有效临时/促销覆盖通常价，未来单尚不适用，到期覆盖退出；促销只有低于通常价时才显示折扣。`beforeAmount` 不是已确认价的必要条件。真正没有可公开有效售价仍显示“价格待确认”，参考价不替代售价。
2. **显示与公开**：DRAFTER_ONLY 推荐商品是参考目录，推荐关联不授权公开私人售价。后台价格面板显示内部价及原因。仅有已确认、启用且当前有效的通常价时可点击“公开商品与售价”，核对商品后单独确认。此操作复用既有产品级发布权限，**同时公开商品主档，并按现有规则影响可购资格**；它不是只公开价格的开关。缺价、禁用、未来/过期或非预购状态禁用此价格面板入口，原通用发布入口不变。取消确认保持私人状态。分类、搜索、详情与推荐继续使用既有公开价格投影；结账授权/价格快照不变。
3. **单位纠正**：从“售价与调价”进入“仅纠正计价单位”，输入不同的新单位、具体原因并核对列表。适用同金额同币种（如 JPY2998/盒→JPY2998/箱），覆盖本商品生效/待生效的单商品网站传票。提交原子校验售价版本和全部相关传票版本；原件保留金额、单位、来源、批准历史并标记作废，新件关联原件，保留金额/期间/类型，更新售价单位。多商品传票、币种或金额变更拒绝此入口；订单历史不改，供应商渠道不改。过期原件不改。刷新后读回新单位、有效价及审计关联。
4. **传票更正/作废**：草稿沿用“更新→核对→批准”；已批准条款不原地改写。对一张可作废传票点击“作废传票”，先查看全部受影响商品及重新解析的通常价/当前价，填写原因并确认。后端锁定并复核预览指纹、商品/传票版本，过时预览要求重新读取，重复请求不能再次作废。永久通常价确认曾同步写入 ProductSale，因此作废不只是改状态：使用可证明的剩余永久价同步基价；最后一张且基价无法独立证明时拒绝，提示另建经审核的永久更正单，不根据 beforeAmount 猜测历史。作废完成后按读回结果核对；需要更正条款时再创建/审核替代单。无业务变化重复确认通常价不增有效传票或售价版本；只改启用/日期等元信息不生成价格单，也不覆盖独立基价。

### 三项功能与两项观察的验收

| 项目 | 判定与证据 | 主要代码 |
|---|---|---|
| 公开确认价 | 合成私人 JPY2998 无公开报价；明确发布后搜索、分类、详情均2998；没有放开所有 DRAFTER_ONLY。生产1495250仍须商家单独授权发布，代码部署不会自动更正真实状态。 | `ProductSaleService`、`ProductPricingPanel`；[浏览器回执](evidence/price-corrections-20261118/browser.json) |
| 单位纠错 | 生效+待生效、原件审计、同币种同金额、外国商家/过时版本拒绝，UI盒→箱最终读回通过。 | `ProductPricingService.correctUnit`、`ProductPricingController`、`ProductPricingPanel` |
| 单张传票 | 永久作废同步可证明基价，待生效多行预览、上下文变更拒绝、重复请求、并发通常价确认通过。通常价确认生成永久单符合既有设计，无变化重复单已修复。 | `ProductPricingService.cancelReviewed`、`ProductSaleService.reviewProduct`、`PriceAdjustmentWorkspace` |
| 后台旧分类 | 原列表来自旧categoryId；改为主路径优先投影，保存后读回。主路径/旧映射/旧分类批量读、共享叶节点/祖先映射，最多5次分类仓库批量读取，不随481商品逐行逐层增加；原有其他价格查询不在此优化范围。 | `ProductCategoryPathResolver.resolveAll`、`MobileProductController.categoryLabels`、`StockMaster` |
| 公开集合 | 现行叶类分页24，一级货架最多8件预览，稳定排序，无轮换代码。生产当前两次同参五件一致；历史第一次缺URL/响应，原因未证，不能归因为轮换或缺陷。本批不改公开分类结构。 | 既有目录服务；[任务证据](../plans/product-price-corrections-20261118.md) |

两张真实指定传票按本机只读证据均 APPROVED/STOREFRONT/PERMANENT、无结束；第二张 beforeAmount=2998。它们代表永久通常价确认历史，并非公开授权；本批没有作废其中任何一张。29件同类私人商品也未批量改动。

针对性检查去重后：后端37项（PriceAdjustmentDocumentIntegrationTest16、ProductPricingIntegrationTest7、PriceAdjustmentResolverTest7、ProductCategoryPathResolverTest5、MobileProductControllerTest2）；前端32项（ProductPricingPanel9、PriceAdjustmentWorkspace5、StockMaster18）通过。局部失败和最小重跑见计划；未在本地重复全项目测试。初始checkpoint dcbfbbb的原生PR checks 44328560700和CodeQL44328561000通过；最终提交自动CI状态另由PR记录，初始CI不冒充最终CI。

命令（实际受影响集合按计划分批执行，并非要求再次运行）：

```sh
JAVA_HOME=/workspace/scratch/jdk MAVEN_OPTS='-Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts' \
  /workspace/scratch/apache-maven-3.9.9/bin/mvn -s /workspace/scratch/maven-settings.xml \
  -f backend/pom.xml -Dtest=PriceAdjustmentDocumentIntegrationTest,ProductPricingIntegrationTest,PriceAdjustmentResolverTest,ProductCategoryPathResolverTest,MobileProductControllerTest test
(cd frontend && npm exec -- vitest run src/components/ProductPricingPanel.test.tsx src/components/PriceAdjustmentWorkspace.test.tsx src/pages/StockMaster.test.tsx)
# 仅core及共同依赖打包，未启动其他服务/全栈：
JAVA_HOME=/workspace/scratch/jdk MAVEN_OPTS='-Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts' \
  /workspace/scratch/apache-maven-3.9.9/bin/mvn -s /workspace/scratch/maven-settings.xml \
  -pl bobbuy-core -am -DskipTests package
```

真实隔离UI使用本仓库Spring Boot、H2内存合成数据及Vite，无API mock；1280×800和390×844。最终四语新增按钮/确认热区≥44px、面板在视口内、页面无横向溢出；最终网络无4xx/5xx、JS errors为空。最终长英文及日文截图经主Agent视觉复核。本机随后发现Checkbox被通用label grid分行，已仅修为flex并保留禁用颜色，追加360/390四语及桌面整图/局部；最终图为unit-checkbox-*、cancel-preview-final-*，取代旧unit-final和有夹具提示的取消图。visual-final.json证明此补图没有实际作废写入。外部模型不可用，未宣称外部审查通过。脚本、失败原始记录、实际模块哈希及截图在 [evidence](evidence/price-corrections-20261118/)；旧失败截图不作为最终通过证据。`reloadPersistence`只指浏览器刷新后的服务器读回，不是数据库重启恢复。

### 生产影响、兼容与回退边界

本机只读提供的当前生产基线为 `5291c4ba9026a334c038fdbaeef54dc9ac40a8c7`（`/opt/bobuy/.cd/deploy-revision`），资产 `index-JXHhwFL1.js`。候选基线main `3e0e935`相比只有文档差异。当前运行与缓存GHCR精确标签/RepoDigest一致：

- Core `sha256:3b091bc270a6035747a62f3ce88a251b6cb3121d3978d50a62599fa98fbf315c`
- Frontend `sha256:23cfae7c52d3737ead6360de52ffa2b0a5295d20f9ca5d365ff1e5344e12424a`

本批无schema、迁移、启动数据修正或批量状态转换。新增审计关联沿用现有JSON evidence，状态仍是既有APPROVED/CANCELLED；原有价格resolver未修改，旧应用可读取取消原件与替代件，代码回退保留数据库现状，不逆转已批准业务操作。新入口须原子配套发布Core和Frontend，旧Frontend兼容新增响应字段；旧Core不支持新操作，回退时须恢复配套旧Frontend。历史订单快照不改。

`/opt/bobuy/.cd/rollback.yml`现引用上次切换前一代，镜像已存在，**不是本次当前版本的回退清单**。本机使用原生CD发布时需由它捕获并保留上列当前精确镜像，回退范围为本批Core/Frontend应用对；核对实际已捕获清单后才可执行，云端不运行切换。生产PostgreSQL archive_mode=off、streaming replica=0、physical slots=0；异地逻辑备份覆盖及恢复点未知，不能承诺业务数据恢复，也不能以旧快照覆盖新写入。

候选只解决代码能力；1495250的产品级公开、单位纠错和真实传票取舍须本机结合商家明确授权独立评估/操作。若只授权公开价格而未授权公开主档，本入口不能代替独立价格发布能力。发布后只读核验须绑定新精确版本、公开报价及后台读回；尚未执行生产发布或线上新版本验收。
