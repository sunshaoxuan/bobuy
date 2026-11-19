# 首页分类图标优先：隔离验收（2026-11-20）

PR #165，基线 `63fe871c8614fcdef1fc42754e18bbb06265916d`。候选应用文件/真实前端构建逐文件 SHA-256 见 `artifact-manifest.json`；最终 Git head 见 PR。本批不合并、不部署、不连接生产。

## 实现与安全边界

- 与商品 overview 同 effect 并行 GET `/api/storefront/category-icons`，商品请求先发。只返回既有全局分类树上 `accessScope=PUBLIC` 的站内图像URL，不含名称、商品、价格、数量或商家身份；只查询图像ID，不读取二进制。空槽保留分类顺序，不据提示决定目录资格。
- 预取最前2个槽位；仅首2图 eager/high，其余 lazy/low。浏览器能提前下载和非等待式解码，商品代码不 await 图片。实际可见目录仍来自 overview；全局前2槽与某商家实际首分类不一致时，overview再提供可见URL回退，不能保证所有网络/商家都先画图标。
- 分类栏先绘制，首货架通过该帧后的0ms任务提交，减少原双rAF额外等待一帧。既有版本绑定、最多2个后续货架并发、首货架≤8、报价及私价/结账边界不变。
- 简中加载词为精确“正在加载”，繁中“正在載入”、英文“Loading”、日文“読み込み中”；不改无关批量管理文案。

## 环境、方法与限制

沿用 #164 的 PG18.6 / Spring18080 / 463件合成公开商品、25货架，AI关闭。`fixture.sql` 只允许现有 `manual_create_synthetic` 测试库，新增23个真实PNG分类图及23个商品图，通过真实数据库媒体HTTP服务，不以 route.fulfill 假图计作正常性能。尺寸/字节数/摘要见 image-fixture.json、product-fixture.json。商品图每类共用一个URL，小PNG非真实生产照片；网络/CPU/资源大小与生产不同，绝不外推这里的绝对毫秒或提升比例。生产只读基线由本机提供，非云端测量。

`serve.mjs` 对main/候选生产构建使用同一静态服务/真实API代理规则，5174/5175均仅loopback；每轮独立Chromium context无HTTP缓存，服务器预热；交替旧/新顺序，正常对照不拦截或延迟API/图片。旧新真实构建记录在manifest；源码测试用例改动不影响产物。构建使用直接 vite build，为浏览器验收产物；未本地重复原生CI的全量test/typecheck。

- `cold-final.mjs` / `cold-final.json`：最终固定9轮×2版本×2视口。DOM与decode回调保留；实际可见图标/首卡顶部文字使用Chromium Element Timing renderTime。回调晚于DOM不等于用户晚看到图标；原始数据分别命名。首图decode时刻是可解码指标，非所有样本都有绘制时间。
- `faults.mjs` / `faults.json`：1920×900及390×844，正常、阻断分类图、分类图404、阻断商品图、阻断第二分类，第三分类照常加载。人工阻断仅验独立性，不当自然性能。
- 现有后端公开投影/报价/隐私和#164分类/搜索/修订用例输入未改，复用其PASS。新增后端公开图像提示1项，前端 helper3 / CategoryImage2 / hook5 / PublicProductCatalog20，共30项定向有效PASS。最终门禁以对应head的原生CI为准。

## 重放命令（仅隔离环境）

```sh
# 既有合成库使用 fixture.sql；不能用于生产。
node docs/reports/evidence/storefront-icon-priority-20261120/serve.mjs
node docs/reports/evidence/storefront-icon-priority-20261120/cold-final.mjs
node docs/reports/evidence/storefront-icon-priority-20261120/faults.mjs
cd frontend
npx vitest run src/useProgressiveCatalog.test.tsx
# helper / image / catalog 已在受影响输入冻结时定向通过，非要求重复运行：
# npx vitest run src/categoryIconPriority.test.ts src/components/CategoryImage.test.tsx src/pages/PublicProductCatalog.test.tsx
# 后端本批唯一新增契约：
# JAVA_HOME=/workspace/scratch/jdk MAVEN_OPTS=-Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts /workspace/scratch/apache-maven-3.9.9/bin/mvn -o -s /workspace/scratch/maven-settings.xml -f ../backend/pom.xml -q -Dtest=CategoryImageServiceTest#publicHintsKeepRootOrderButExposeOnlyExplicitPublicImageUrlsWithoutReadingBytes test
```

main构建来自独立detached worktree `/workspace/scratch/icon-base`，与候选共用已存在依赖；构建分别写 `/workspace/scratch/icon-built-base` 与 `icon-built-candidate`。不是另起数据库/测试环境。控制台及API状态、资源时序、几何包含在faults.json；正常和故障整幅视口截图/导航原尺寸局部同目录。

## 未采纳试验及原生CI

所有未成立结果保留：cold-rejected-frontend / decode / mobile-card / one-frame 为Vite开发模式；cold-production为双rAF生产构建9轮；cold-paint-double-frame为增加实际绘制观测后的9轮。最后才减少双rAF的多余一帧。不得以这些数据替代final，也未挑选幸运轮次。阶段时间与方法变更在任务指导中逐项记录；因定位Vite双i18n和测量口径/性能未决，超过初始浏览器30分钟预算。

首次head68931的CI 44565660873：后端和CodeQL通过，前端997/998。唯一失败是未修改的ProductMarkerEditor权限冲突用例：已有alert后按钮仍处于AntD loading退出窗口，accessible name为“loading Save markers”，同步断言寻找“Save markers”。该测试mock仅productMarkerApi，不引入首页hook/图标，marker词条不变。没有直接关联证据，不修改无关测试，最终冻结head的自动CI负责确认；必要时只由云端一次失败Job rerun。

M3/M6无可用Claude/Gemini连接，按项目降级由主Agent实现和原图视觉复核，不宣称外部模型PASS。无schema/生产数据迁移，前后端可成对回退；新前端在旧后端提示404时仍走overview图像回退，不改变购买授权。

## 最终判定（不得省略限制）

功能与图标优先成立：最终固定9轮/视口共18个候选样本，实际图标绘制18/18早于首卡顶部文字。10项正常/故障UI PASS；提示端点404的单独兼容回退另见hint-fallback.json。主Agent复核真实整幅截图和原尺寸导航局部：分类图48×48、入口宽88/高≥44、桌面控制44×44，已有横滑容器正常、document无横向溢出，缺图保留入口/文字。没有新增CSS；此前360px/长语言布局证据按不变输入复用，本批新截图限1920/390。现有超长合成ITEM/热度布局未调整，不把整站所有元素宣称为新验收。

**首卡中位数严格不退化尚未成立，候选不能宣称全部目标PASS。** 最后源码固定九轮全部保留，无选择轮次。下表单位ms；框架/栏/卡为DOM，图为decode回调，最后两列为Chromium实际绘制。

|视口/版本|框架|分类栏|首图标decode|首卡DOM|首商品图decode|首图标绘制|首卡绘制|
|---|---:|---:|---:|---:|---:|---:|---:|
|1920/baseline|531.4|693.4|902.4|868.1|986.1|848|1024|
|1920/candidate|589.2|740.8|775.1|870.1|987.3|804|1008|
|390/baseline|530.9|661.9|813.5|807.8|908.8|748|904|
|390/candidate|546.5|697.9|744.4|819.7|928.8|736|920|

桌面首卡DOM+2ms，手机+11.9ms；实际首卡绘制桌面-16ms，手机+16ms。共享云端时序有波动，前三轮/九轮曾给出不同方向；这里如实留下最终值，不把微小差异擅自改判为无退化，也不以多跑直到PASS替代判断。本机提供的生产1220/1204ms首卡、1891/1789ms真实图标仅作背景，不能与隔离绝对值直接比较。后续由本机评估此限制及真实生产条件；云端没有合并或触发发布。
