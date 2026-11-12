# 并行发布后的生产只读核查

## 结论

截至2026-11-12 11:45:25 JST，当前生产已经累计包含本批排序、逐次点击热度与星级评分，以及后续编辑器/评分外观、邮件配置界面和社交平台选择/文字对齐调整。各项由后续版本依次继承上线，当前前端源码与远端main一致。此次核查未执行任何发布、重启、迁移、数据写入或详情点击。

| 运行部分 | 实际版本 | 核查结果 |
|---|---|---|
| 前端 | bobuy/frontend:20261112.social-platform-select.2，ec24fa9 | 11:39:50 JST启动，发布状态先VERIFIED后CLEANED，运行中 |
| Core | bobuy/core:20261112.reference-sort，a14f032 | healthy，镜像摘要与本批最终验收相同，容器10:49:41 JST启动 |
| 数据库 | PostgreSQL18.6，Flyway V33 | V33 product clicks和V32 user product reviews均success，点击表存在 |
| 入口维护状态 | 维护规则未配置 | 正常浏览器请求成功 |
| 远端main | ec24fa9 | 与当前前端来源相同；backend、Core、公共库及根pom与运行Core源码无差异 |

生产前端镜像为sha256:4568e063d0ce3caf772759ce0f31a1e09b4d2e4d8ece8f49d476d25a232f6470，Core为sha256:98a2a9ec3a4511029b1b65bc602d4654e6155340d4fa3dff8199da63e9565bce。初始核查时前端为social-platform-select/961d2a3，调查期间另一流程在11:39:50 JST切换至上述.2版本。首次资源清单因此失效，保留初始记录并改用新镜像清单验证。

## 一起上线的依据

当前ec24fa9的祖先包含本批归档c680934、main合并6665da7、编辑器012013a和邮件设置对齐f4fae3d，祖先关系均由Git实际检查通过。服务器发布回执的前端继承链为reference-display.4 → editor-rating → mail-settings.2 → mail-settings.3 → social-platform-select → social-platform-select.2。Core沿用reference-sort代码。发布回执和镜像摘要共同支持已继承上线的判断，目录存在本身未作为成功证明。

截至最终快照，未发现/opt/bobuy下的活动发布锁，也未发现使用该目录发布Python脚本的远端进程；这项观察仅覆盖该时点的远端进程与锁。当前.2回执CLEANED，容器身份与浏览器前快照保持一致。

## 真实浏览器检查

本程好物和好物推荐分别在1440×900及360×900共4个状态检查，每页24张实际公开商品卡片。两列表的7项排序均取得正常浏览响应，卡片热度与5颗星正常存在，无横向溢出。18个实际加载的JS/CSS响应摘要与当前前端容器文件完全匹配。最终检查没有页面JavaScript错误、控制台错误或异常网络响应。

浏览器未登录，阻止业务写请求；未尝试详情点击、评分保存或邮件发送。Cloudflare的/cdn-cgi/rum遥测在浏览器本地响应204，未发送到生产，5次本地拦截记录保留。首次只读工具使用abort导致遥测控制台错误，并在换序加载尚未完成时检查卡片，部分检查未完成；修正本地遥测响应和非空卡片就绪条件后，最终完整检查PASS。这些工具阶段结果独立保留，未当作产品错误或验收PASS。本次只读核查确认功能保留，原数据库并发、重复点击及评分保存测试仍引用原精确源码验收。

已查看真实桌面和手机截图，排序控件、商品卡片与评分均来自当前运行环境；本次没有修改可见UI。邮件配置、编辑器及社交平台的完整业务流程没有在本次重新操作，结论范围为其版本已包含在当前生产前端。

## 证据与范围

独立证据目录：[live-audit](evidence/product-engagement-production/live-audit/)。[最终运行快照](evidence/product-engagement-production/live-audit/runtime-final.json)、[来源绑定](evidence/product-engagement-production/live-audit/source-binding.json)、[浏览器](evidence/product-engagement-production/live-audit/browser.json)、[桌面本程好物](evidence/product-engagement-production/live-audit/products-1440.png)、[手机好物推荐](evidence/product-engagement-production/live-audit/recommendations-360.png)。初始及切换后的快照和不完整工具运行另存，不覆盖既有生产验收证据。

最终意图复核：当前版本、并行发布顺序、本批功能保留、main一致性、公开页面资源及远端活动状态均已核查。全部必需只读核查PASS；本批无生产修改，无新增测试数据。报告与证据保存在独立审计分支，不推送main或触发新发布。
