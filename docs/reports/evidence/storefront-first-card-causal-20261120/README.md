# 上线后首卡差异：有界因果复核（2026-11-20 JST）

**判定：未找到可验证、能稳定改善首卡的最小修复；应用代码不改，不新开代码PR，不发布。** 本轮只有调查材料。基线为已上线 main `874a23cb4dc922298e2ef4ea2c4938c96f6f17cb`；实际加载资产与#165既有产物一致，见runtime.json。两项已通过功能（图标优先、准确“正在加载”）及原生CI按不变源码复用，本机生产验收不重做。

## 本机生产证据与边界

本机稳定窗口：桌面/手机10/10真实图标先于卡，中位提前526/510ms；首卡1220→1425ms /1204→1344ms。差异集中于overview780→1116ms /867→1022ms，响应41921B未变；响应到首卡107→88ms /98→87ms。初始慢轮后回落，不作为稳定样本。四轮启用减关闭overview差桌面-1246,-229,+745,-767ms，手机+215,+470,-8,-79ms，方向不一致，不能认定预取为唯一根因。这些是本机提供的数据，云端没有访问生产。

## 直接源码发现

- `backend/src/main/java/com/bobbuy/service/RecommendationService.java:350`：分类图与商品图共用image()。首先读全部deletedIds；存在任意软删商品时，读取全部推荐图片引用、全部在用商品图库、全部软删商品图库，Java侧过滤/反序列化，最后查PUBLIC图片。每张提前图片可把该全局读取移入overview进行中的时段；不是只有约67KiB传输。
- `ProductRepository.java:14`、`RecommendationItemRepository.java:15` 定义这些无商家/单图过滤的内部授权读取。它们也保护已删商品的图片，不能为性能直接跳过或按PUBLIC标记一概放行。
- `CategoryImageService.java:23` 的提示只读分类树及PUBLIC图片ID，两次数据库读，不读图片二进制。分类图上传/结构导入有明确根节点PUBLIC绑定，但专用轻路径若另行实施须验证私图、仅软删引用、撤销分类绑定等边界。本轮不扩展此接口或改变授权。

## 同条件实测

复用既有PG18.6/Spring/前端生产产物，465件活动合成商品。发现旧夹具软删数量为0，未触发生产有14条软删记录的图片扫描路径；本轮加入14条独立合成软删记录。前两图各68608字节有效PNG，经真实数据库媒体HTTP返回。用PNG辅助块补足负载，保留原像素，因此**只匹配传输大小，不等同生产图像解码复杂度**。无生产业务数据修改。

`server-causal.py`：12轮轮换顺序，同时发overview、提示及0/1/2图，无网络延迟/限速。overview服务端中位：单独67ms；加提示73.5ms；加提示及一图79.5ms；加提示及两图86ms。两图减单独的配对差中位16.5ms，9/12为正；有-17到+123ms波动。存在小量竞争迹象，不能用它解释生产155–336ms的overview增长，更不能按比例外推。

`browser-causal.mjs`：每视口固定6轮、四臂轮换，共48个独立冷浏览器context；相同真实产物、相同API和67KiB图片。off只抑制早期提示；sql-only真实请求提示但不提前图；two为当前源码；one仅模拟一图早取。sql-only/one在native fetch完成后处理提示JSON，不通过route.fetch绕开浏览器网络。每轮记录后等networkidle再开始下一轮，避免未完成后台请求串扰。正常请求无人工等待、限速或伪图。API服务端cost通过X-Trace-Id与网络时序关联。

|视口|臂|overview TTFB|overview服务端|首卡DOM|首卡绘制|图标早于卡|
|---|---|---:|---:|---:|---:|---:|
|1920|off|82.4|79.0|857.3|972.0|6/6|
|1920|sql-only|78.7|75.5|862.2|1040.0|6/6|
|1920|two|84.1|82.0|836.3|960.0|6/6|
|1920|one|82.9|80.5|876.1|1012.0|6/6|
|390|off|83.9|78.5|904.8|984.0|6/6|
|390|sql-only|73.7|69.0|856.9|932.0|6/6|
|390|two|91.8|89.0|830.2|896.0|6/6|
|390|one|70.9|69.5|825.4|930.0|6/6|

单位ms。one对two并未给出一致首卡改善：桌面DOM约+40ms/绘制+52ms，手机DOM约-5ms/绘制+34ms。因此拒绝“一张早取”的试改，不把移动overview下降直接冒充首卡修复。四臂包括off在本地均能先画图标，进一步说明此loopback不能复现生产图标网络延迟机制。

## 具体限制及剩余路径

- 浏览器测得图片传输约0.5–1.2ms、overview排队约1ms；是loopback HTTP/1.1，无公网/TLS/HTTP2。此条件不足以归因生产带宽/优先级竞争。
- 合成推荐项为0，活动图库JSON总58110字节；生产推荐引用/图库规模和全局其他商家的扫描工作未绑定。合成overview transferSize22306B（含浏览器固定开销），生产响应体41921B；合成服务端约70–90ms，不能代表生产约1秒的临界路径。
- browser共享CPU/启动耗时波动；没有追加轮次追PASS，没有把图片大小对齐误称环境完全等价。
- 后续最小证据是同一请求trace的浏览器TTFB、网关upstream耗时、Spring cost；先分清增长在应用、网关还是客户端。若Spring cost增长与提前图片重叠，再定位上述四项内部读取/反序列化在真实规模中的耗时；若Spring稳定，检查网络协议、连接/优先级和传输。不要先重构商品dataset或引入缓存。
- 单图早取已经在本轮受控模拟且没有稳定首卡收益，不建议直接交付。分类图专用授权读取是一个待证实的后续方向，必须先取得它占用关键路径的证据，并保留私图/删除保护；本轮未实现。

## 命令与产物

```sh
# 仅既有隔离合成库，fixture.sql内有ON_ERROR_STOP及单事务数据库名保护：
docker exec -i bobuy-manual-create-test psql -U postgres -d manual_create_synthetic < docs/reports/evidence/storefront-first-card-causal-20261120/fixture.sql
python3 docs/reports/evidence/storefront-first-card-causal-20261120/server-causal.py
node docs/reports/evidence/storefront-first-card-causal-20261120/browser-causal.mjs
```

server-causal.json、browser-causal.json保留全部样本，不筛选；assessment.json包含排队/传输/响应后阶段；fixture.json/runtime.json绑定输入及既有资产。没有应用源码变化，不跑单元全量、不重建、不启动新CI或新栈；必要检查为本次固定实验、日志关联、SQL保护和文档静态检查。任务指导预算内完成实验后停止。保留共享隔离服务/可重复夹具和正式证据，删除本轮一次性夹具生成器；未连接、写入或部署生产。
