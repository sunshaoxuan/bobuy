# 商品排序、点击热度与星级生产验收

2026-11-12，Asia/Tokyo。本批功能已发布，V33已建立。最终运行 Core 为20261112.reference-sort（a14f032），前端为20261112.reference-display.4（deac521），已保留并行上线的账户布局、维护文案和参考价调整。

## 交付及数据边界

本程好物和好物推荐支持价格、平均星级、人气双向排序。完整筛选集先排序再分页，实际销售报价优先，同币种分组。过期或未来优惠的推荐排序与卡片展示共同使用ReferencePriceDisplay，未知价格排在末尾。每次详情点击原子累计，重复点击重复计数，卡片右下显示火苗热度；同页和跨标签同步。鼠标悬停预览、点击或键盘选择星级，保存后计算真实平均分。

点击和评价始终属于操作时的商品主档。同一商品共享指标，推荐改绑不搬移其他商品的历史记录。商品历史、关联、订单及原业务字段未由本批迁移修改。V33只新增bb_product_click及主键、外键和非负计数约束。

## 发布与恢复

1. 20261112.3完成暂停写入后的新鲜数据库备份、隔离恢复完整指纹比对、实际Java17候选迁移，以及旧Core在V33上的启动和HTTP读取验证。真实生产迁至V33后，开放写入前超出原300秒维护预算，保护器恢复原应用，保留V33及数据。
2. 20261112.4准备后检测到并行账户前端变更，在修改应用前拒绝激活。重新整合账户与维护文案。
3. 20261112.5于08:38:15 JST开放写入，窗口250.38秒；新鲜备份SHA256为14b468754345f0804d0bdcee8d827c7787c913dba6e400b7d751eb047434d1ee，实际恢复指纹通过。既有业务内容和受保护服务检查通过，源码606deb3与两个镜像及加载资源绑定。
4. 随后的reference-display.4保留本批功能。联查发现推荐价格排序与恢复后的原价不一致，本批反例验证了错误顺序并完成独立修复和666项覆盖率门禁。并行reference-sort发布了等价修复，版本校验在本批计划激活前检测到它。本批采用已验证的线上实现，取消重复切换。最终工作树的backend/frontend及Core构建输入与a14f032完全一致。

所有恢复均保留当前数据库。开放写入后禁止旧备份覆盖新写入。正式备份、恢复镜像和配置保留在/opt/bobuy/releases对应目录，未进行全局Docker清理。

## 验证矩阵

| 项目 | 结果与证据 |
|---|---|
| V33、保留数据、幂等、120并发、关联归属 | PASS，原本地真实PG证据继续有效；生产V33约束和清理检查见final-data.json |
| 新鲜备份与旧版兼容恢复 | PASS，backup-check.json、activation-backup-check.json、对应运行库指纹；候选和恢复Core实际Java17 |
| 后端最终门禁 | PASS，线上a14f032精确绑定666项零失败、24条件跳过、配置覆盖率通过；本批独立候选也通过666项，记录其不同源码身份 |
| 前端整合门禁 | PASS，773项全量及账户整合后773项全量；维护文案6项专项与构建；后续前端保留111项相关回归及原发布门禁，当前资源按其实际清单重新绑定 |
| 最终生产交互 | PASS，重复计数、同页/跨标签同步、悬停点击保存及均分、刷新、匿名限制、2000字保存及2001拒绝，browser.json |
| 真实公开商品排序 | PASS，两列表全部七项选项；1440/768/320宽度下12组实际显示价格升降序无逆序，real-pages.json |
| 控制台、网络、响应式 | PASS，无站点JS错误或异常响应，三档视口无横向溢出 |
| 实际制品绑定 | PASS，最终Core镜像/JAR、前端镜像/来源及18个实际加载资源匹配，final-production-binding.json |
| 几何与视觉 | PASS，29项像素预算、原尺寸图、末卡可达、独立Gemini复核及主Agent判断，VISUAL-REVIEW.md |
| 临时生产数据清理 | PASS，账户、商品、推荐、评价、点击及认证会话均为零，恢复数据库与探针容器均已移除，final-data.json |
| 本地过程产物清理 | PASS，release-cleanup.json、drive-map-cleanup.json；构建缓存、临时映射及任务过程目录均已移除 |

截图使用真实公开商品，评分弹窗采用明确标记的临时合成数据并已清理。验收为真实桌面Chrome的响应式视口，未进行手机真机软键盘测试。测试未创建客户订单。

服务健康采用容器检查和现有管理通道的内部健康接口，结果通过。公开非浏览器健康探针返回403，公开访问边界保持原状；真实浏览器业务请求检查通过。最终CodeQL已通过GitHub API复核，head_sha与a14f032完全一致。

收尾时Windows控制台对临时盘映射目标的非ASCII字符转换导致严格字符串核对拒绝。随后通过QueryDosDeviceW核对同一实际Unicode目标并移除自建映射。清理删除的一张过程诊断图从最终元数据清单退役；原绑定和原回执保留，v2回执重新验证其余图片及全部引用摘要，代码、制品和功能/视觉证据保持一致。

## 证据入口

正式证据目录：[product-engagement-production](evidence/product-engagement-production/)。主要文件：[最终绑定](evidence/product-engagement-production/final-production-binding-v2.json)、[最终回执](evidence/product-engagement-production/final-acceptance-v2.json)、[最终线上门禁](evidence/product-engagement-production/successor-sort-release.json)、[浏览器](evidence/product-engagement-production/browser.json)、[公开页面](evidence/product-engagement-production/real-pages.json)、[数据清理](evidence/product-engagement-production/final-data.json)、[视觉](evidence/product-engagement-production/VISUAL-REVIEW.md)、[像素](evidence/product-engagement-production/pixels.json)。

最终意图复核：排序、逐次点击、热度展示、星级录入及均分、关联归属、持久化与同步、备份迁移及现有数据保护、真实页面/几何/视觉、过程清理均有独立有效证据，全部PASS。本批生产交付完成。

版本归档：本地验收提交44da8f0已保存，工作树干净。向远端推送原任务分支及独立验收分支均被Git服务以directory file conflict拒绝，远端分支归档未完成；该结果不改变已验证的生产镜像、迁移及页面证据。
