# 二级连续商品分区：候选验收

代码基线 `9cd17e8c25b0d5b9960cb11090526ee6cae522f9`；独立分支 `fix/storefront-product-category-icons-20261120`。源码 checkpoint `4e15ac34c4a0815d3764f591350ced40e5f7acdd` 后只收紧新标题 CSS 级联；最终提交见本 PR head。未合并、未部署、无生产或合成数据库写入。

## 行为与读取合同

- `/products` 全部页按权威分类路径形成互不重复的二级分区，保留纯文字一级标题。选中主类复用普通 browse 的真实二级 `shelves/total`，不从平铺第一页猜分组；显式叶类仍为原单类分页。
- `GET /api/storefront/product-browse/overview?sections=true`：同一次公开投影和修订返回全部分区元信息，第一分区仅8件，其余空items；导航先提交，不等待图片。
- `GET /api/storefront/product-browse/shelf?sections=true&scopeCategory=<当前主类或空>&category=<真实分区ID>&page=0&revision=<导航修订>`：分区页24件。页0验证原8件有序前缀再替换；后续追加、拒绝重复/混合修订，按该Shelf.total精确判断末页。外层matchedTotal/hasNext沿用浏览范围元信息，不当作分区剩余页；分区消费者按total、页号及返回长度判断。
- 最多2个分区请求并发，可独立重试。根直挂/未分类保留纯文字区；选中主类若混有根直挂而普通API不返回子货架，沿用原完整平铺安全回退，不丢商品。
- 每个二级标题+24px自身图片在其section内sticky，下一section自然接替，非全页固定面包屑。显式叶类只有一个当前h2；父级操作保留，一级不增加图片。缺图/失败/空类仍可读。
- 只读复用原publicEntries、商家范围、公开投影/修订；报价、可购买授权不变。无schema或迁移。旧前端不传sections保持旧端点行为；发布需先具备兼容后端再切新前端，代码回退不涉及业务数据恢复。发布由本机协调。

## 实测与精确产物

最终前端入口 **`index-DoiMe8lM.js`**（最新main+本PR源码）。复用Spring/PG18.6实例，`ManualCreateRuntime`端口18080、前端5185；无新Docker栈。后端已加载候选编译class：

- PublicProductBrowseService SHA256 `a90e01c4c5eab6ceaec66fa577731ff6fb905bdc7538aa16e5d9a442cbb7f9db`
- PublicProductBrowseController SHA256 `ecfde4f1ea5094fe4f8a1a6864ff03d3e3db9aaba0a2f1809b2f5561a60c996b`

| 检查 | 360×800 | 390×844 | 1280×800 |
|---|---|---|---|
| 全部/主类 A正常→吸顶→末件通过→B接替→回滑 | PASS | PASS | PASS |
| A/B吸顶坐标，正好接既有分类栏底 | 229px | 229px | 209px |
| 25+15分区完整末页、无重复 | PASS | PASS | PASS |
| 标题字/图 | 18px/24px | 18px/24px | 20px/24px |
| 极长叶标题：零内margin、完整文字 | 2行/67px表面 | 2行/67px表面 | 1行/44px表面 |
| 8张商品图片完成0时已有首8卡；慢后分区不阻前区 | PASS | PASS | PASS |
| 主类入口→叶、侧栏→叶、刷新、空类、坏图回退 | PASS | PASS | PASS |
| 无横向溢出/JS异常/非预期失败请求 | PASS | PASS | PASS |

原生CI负责全项目门禁，见本PR最终head检查；本地没有全量预跑。定向前端32个相关用例按输入复用通过（渐进7、商品页23、导航2）；后端20个相关用例按输入复用通过（公开商品浏览16、HTTP契约4）。实际命令及首轮夹具/等待失败与最小修正已写入既有[任务指导](../../../plans/STOREFRONT-STICKY-CATEGORIES-20261120.md)。没有将失败轮次写成PASS。

## 截图与数据

最终整图及同区原尺寸局部均在本目录：

- 360：[A吸顶](overview-sticky-360.png) / [局部](overview-sticky-360-detail.png)、[A边界推出](overview-pushing-360.png)、[B接替](overview-replacement-360.png)、[回滑](overview-reverse-360.png)
- 390：[主类正常](root-normal-390.png)、[A吸顶](root-sticky-390.png)、[B接替](root-replacement-390.png) / [局部](root-replacement-390-detail.png)
- 桌面：[全部A吸顶](overview-sticky-1280.png)、[B接替](overview-replacement-1280.png) / [局部](overview-replacement-1280-detail.png)
- 最窄长名：[最终长标题](final-long-360.png) / [局部](final-long-360-detail.png)、[空类](final-empty-360.png)、[坏图回退](final-failed-360.png)
- [visual.json](visual.json)：最终全部/主类序列、真实未改响应首屏、控台/网络、边界矩形及asset。
- [title-layout.json](title-layout.json)：最终CSS下长名/空/坏图三视口几何与网络。
- [edges.json](edges.json)：独立功能边界结果；运行于`index-BoU4anf1.js`，其后只改新标题CSS优先级。功能证据复用，旧字号截图已清除；最终视觉以visual/title-layout为准。

**夹具边界**：实际App和实际Spring/PG匿名公开API已验。现有合成库每根20件；25+15跨页/接棒用浏览器限定的响应夹具，将40个不同的既有合成商品分区，不改DB。首次8件、24+1末页及跨范围/修订拒绝另由真实Java服务测试覆盖。示例“饮料/果汁/面包谷物与抹酱”只是合成展示名，不是生产分配事实。图像显示合同仅复用已存储的合成PNG字段夹具，未生成、上传或接收素材；截图内小图不是生产142张单色线稿。线上已绑定的真实imageUrl由本机对精确候选独立复核；代码始终读取本级facet.imageUrl，不借一级图回退。云端未做生产访问/写入/发布验收。

主Agent已逐图检查手机A/B/长名及桌面，按既定M3/M6外部服务不可用降级；未声称外部模型复核。

## 本机重放入口

同一隔离环境已运行前端5185，以下脚本仅公开GET及浏览器响应夹具，无业务写入。生产只读复测可直接进入 `/products` → 饮料主类 → 果汁叶类，另选total>24分区检查末页；核对主类筛选和回滑。

```sh
node docs/reports/evidence/storefront-secondary-sections-20261120/serve.mjs
node docs/reports/evidence/storefront-secondary-sections-20261120/visual.mjs
node docs/reports/evidence/storefront-secondary-sections-20261120/edges.mjs
node docs/reports/evidence/storefront-secondary-sections-20261120/title-layout.mjs
```

`serve.mjs`复用既有18080；5185已运行时不要重复启动。fixture ID见脚本，不能指向生产运行夹具脚本。检查已通过后无需重复本地全套。
