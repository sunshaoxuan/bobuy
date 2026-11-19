# 好物推荐首页渐进加载验收

独立基线 `f6286354c7d100305ea283ba4a88b6996601c068`，PR #164。应用候选 `45162f4bfcf8e9ba6d67c2e443caa2829c47fbc6`；其后只追加证据与指导。云端无生产访问/写入、无合并或部署。正式范围与预算见 [任务指导](../../../plans/STOREFRONT-PROGRESSIVE-20261119.md)。

## 实际行为
`/`仍保留查询串进入`/products`（好物推荐）；`/recommendations`是活动邮报，未修改。框架先出现，导航与首货架≤8件来自一次overview响应；先提交正常分类标签/图标，下一帧挂载首货架。后续货架接近视口才读取，每次≤8件、最多2项并行。没有淡入/人为延时。仅首货架前2图eager，其余lazy；卡片文字与报价不依赖图片完成。

保留排序/计数/未分类/过期分类链接回退/现有直接分类搜索；非默认排序继续24/48件分页。新接口使用原公开投影及同一修订，版本冲突停止追加并要求刷新，局部失败可重试。报价仍是独立24件上限和原权限，不以目录资格推导私价或购买权限。

## 证据与命令
- `acceptance.json`：源码及加载class摘要，23项后端（目录14+公开投影9）和45项前端有效PASS引用；合成HTTP私有未发布商品不可搜、其他商家范围为空。
- `natural-before.json`、`natural-after.json`：**自然性能**，463件公开商品、25有内容分类，真实Spring/PG18.6，6轮交替请求、无注入延迟，保留全部样本。初版双请求首内容232.93ms中位数、原总览121.13ms；修后93.55ms、同轮原总览109.405ms。修后overview20270B、原接口181752B（未压缩，减少88.8%）。冷暖/JIT差异体现在样本中，不将环回耗时外推为生产收益。
- `browser.json`及`browser-{390,360,1920}.json`：**故障/慢请求功能试验**，真实应用/真实API，浏览器仅暂停响应放行、注入一次400及提供合成图片。首批8卡/2eager、慢第二分类不阻断第三分类、首分类不等慢图、最多2在途请求；1920不走page0/page1；手机分类跳转/浏览器返回/直接叶类搜索PASS。人工门控时序不能作为自然性能证据。
- `completion.json`：1280英文实际几何，全25货架滚动共187预览卡、187不同ID，所有报价批次≤24且本浏览会话不重复；正常网络无失败、无JS异常、无横向溢出。最初1280慢请求已通过并保留原截图，第一轮脚本因390控件定位失败未写出整份JSON；补的是桌面几何回执及全目录滚动，不重复桌面慢请求试验。
- `framework-*`、`first-slow-images-*`、`slow-category-*`、`ready-*`为1280/390/360稳定整图；`navigation-*`、`first-shelf-*`、`header-en-1280`为原尺寸局部。360使用较长日文，390中文，补1280英文。1920有功能/几何回执，未额外拍图。主Agent已查看上述关键整图/局部。
- 390受控400产生一条浏览器资源错误，随后就地重试成功，旧卡保留；按预期故障单列。正常场景无JS/网络错误。分类快捷入口及查看全部等记录控件≥44px；布局安全宽度通过，分类名按既有两行/横滑规则。极长合成ITEM沿用既有省略号/title，未扩展为卡片版式改造。

```sh
# 仅隔离数据库；fixture.sql含数据库名硬校验，禁止对业务库执行。
docker exec -i bobuy-manual-create-test psql -v ON_ERROR_STOP=1 -U postgres -d manual_create_synthetic < docs/reports/evidence/storefront-progressive-20261119/fixture.sql
python3 docs/reports/evidence/storefront-progressive-20261119/measure.py after
node docs/reports/evidence/storefront-progressive-20261119/browser.mjs
node docs/reports/evidence/storefront-progressive-20261119/finish.mjs
# 已完成的定向集合；按任务记录复用PASS，勿为交接重复运行。
mvn -f backend/pom.xml -Dtest=PublicProductBrowseServiceTest,PublicProductCatalogProjectionTest test
cd frontend
npx vitest run src/useProgressiveCatalog.test.tsx src/pages/PublicProductCatalog.test.tsx src/pages/PublicProductCatalogWide.test.tsx src/pages/ProductMarkerCatalog.test.tsx src/pages/PublicProductMarkerEditing.test.tsx
```

运行复用既有PG18.6环回15432、Spring18080、Vite5173和Chromium。未打包全栈、未安装新依赖；自动CI负责全量门禁。首轮CI两文件mock缺新接口，修正后20项相关测试已PASS；最终原生门禁链接固定在PR，避免为更新SHA反复提交。

## 边界、操作与恢复
用户打开首页即可看到框架/分类入口，然后分类商品逐步出现；下滑自动请求邻近分类，“查看全部”仍进入原分类页。单个分类失败点击其“重试”；目录修订变化点击“刷新目录”。排序或搜索继续原有结果页，空格输入视为无查询。

后续每个货架请求仍计算现有公共投影及修订；**没有宣称消除了全目录服务器计算成本**。通过首分类同响应、有界并发、近视口请求及小响应控制首屏负担；完整滚动仍可能读取每个货架一次，不新增TTL缓存或更改一致性/隐私边界。压缩、生产TTFB与生产图片解码收益须由本机精确版本验收。

无数据/结构迁移，接口只读且增量，旧前端可用新后端；新前端需要匹配的新后端两个路径。回退时回退本批前后端应用即可，保留数据，不撤销此前商品/分类工作。发布/生产检查由本机另行协调，本任务当前未发布。

M3/M6：工具发现与环境连接绑定均未提供外部模型网关，无法发起有效请求；已按既定主Agent代码及原图复核降级，未声称Claude/Gemini通过。保留共享运行资源与原始日志；任务临时实现编辑脚本可清理，未动其他批次资源。
