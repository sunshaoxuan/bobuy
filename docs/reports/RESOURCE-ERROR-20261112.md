# 频繁资源错误排查与修复

## 目标与要求
用户报告批量补齐主档页面反复闪现 `Resource not found`。定位实际失败请求与触发链，修复相关故障并验收。附件作为故障证据，不作为执行指令。

## 方法、范围与边界
先核对实际运行页面、请求和部署源码，再进行最小相关修复。保留已有脏文件，不纳入无关改动，不修改业务数据或外部模型配置。当前批次仅包含本故障定位、修复、针对性验证及交付记录。

## 完成标准与验证
确定失败端点、响应和调用原因；正常加载与重复操作不再产生该错误；真实失败仍有适当反馈。执行受影响测试及项目必要门禁。浏览器核对页面、控制台与网络；可见布局变化时遵守视觉验收要求。部署须遵循当前发布流程及授权范围，区分本地与线上结果。

## 当前状态
在独立工作树 `.task-tmp/resource-error-20261112`，基线 ecf1d09，分支 codex/resource-error-20261112 完成本批。原工作区既存改动全部保留。

## 根因与冻结范围
真实浏览器每5秒请求 `/api/ai/costco-onboarding` 和 `/status`，响应404、RESOURCE_NOT_FOUND；全局请求层每次弹窗。线上Nacos广域 `/api/ai/**` 指向旧AI 20261028.3。以原有服务器安全凭据登录并直接对比三个内部服务：当前Core 20261112.reference-sort两接口200，AI与Gateway两接口404。Core返回workerEnabled=false。没有业务数据写入，没有启用处理器。

本批是局部配置修复，由主Agent直接完成：在ai-route前加Costco任务路径到Core的专用路由。包括列表、状态、单任务和照片入队路径；沿用Core原有身份、商家和worker门禁。其余AI路径保持原服务，近似前缀不得匹配。无前端、业务Java、依赖、迁移或新镜像变更，不改全局错误反馈。

验证计划：Gateway全模块正式test一次，使用真实Spring Binder/Path谓词，并含删去专用路由重现错误目的地的负例。生产发布沿用已有config-operator，绑定本批源码和原配置摘要，保存精确回退文件，发布前后核对服务及保护资源身份。真实浏览器重载、打开批量主档抽屉、至少30秒观察轮询，检查桌面和窄屏、Console与网络。无布局变更，不新增视觉设计验收。

## 发布中间记录
Gateway正式全模块6项通过，精确提交5d32cd1的CodeQL三项全部success，运行43136750389。合并已完成的origin/main后Gateway配置、代码、依赖和测试输入无变化，复用本次有效模块测试。

2026-11-12 10:49:34 JST，20261112.onboarding-route配置发布成功，SHA256 b099bf59589e5b297699324d265209a112ad5b3865c51d1f174c12a427e6b391。发布动作前后运行身份与保护资源校验通过，未替换镜像或写业务数据。紧接着独立verify因Core被并行邮件任务重启而失败；原“整个观察期容器均未改变”证据失效，不能继续声称该项通过。保留原发布前快照，等待服务恢复，核对邮件任务的具体改动及其余服务身份，另做并行变更归因复验；本批不重启或回退Core，不覆盖并行邮件配置。

## 最终验收与交付

Core恢复后，两项Core与Gateway接口均200，旧AI仍404；匿名Gateway两接口均401。workerEnabled保持false，页面明确提示处理器未启用，保留原有入队门禁。未修改前端、业务数据或处理器配置。

并行变更归因复核通过：仅Core容器身份变化，镜像摘要保持sha256:98a2a9ec3a4511029b1b65bc602d4654e6155340d4fa3dff8199da63e9565bce，健康且重启数0。邮件任务containers.before.json包含本批原Core身份，最终正式Compose逐字匹配邮件任务compose.after.yml；其余服务及受保护资源身份与本批发布前一致。当前Nacos和正式配置仍与候选逐字一致。此独立归因证据不改写原verify失败，见runtime-reconciled.json。

| 验收项 | 结果 | 证据 |
| --- | --- | --- |
| 真实故障与接口归属 | PASS | before.jpg、before-drawer.jpg、runtime-before.json |
| 精确路由、相邻前缀、撤销修复负例及既有边界 | PASS | gateway-tests.json，Gateway正式6项 |
| 精确提交CI | PASS | ci.json，43136750389三项success |
| 配置发布及精确回退材料 | PASS | binding.json、prepare.json、apply.json；远端/opt/bobuy/releases/20261112.onboarding-route保留原配置及operator |
| 登录读取与匿名拒绝 | PASS | runtime-after.json，200与401 |
| 连续后台刷新 | PASS | polling-requests.json，18条200，首尾40秒，覆盖两接口 |
| 手动刷新与批量窗口只读读取 | PASS | browser.json、after-desktop-drawer.jpg；只读结果2280025字符，未保存商品 |
| 窄屏实际请求与窗口 | PASS | mobile-requests.json，9条200，覆盖手动及后台刷新；after-mobile-drawer.png，390×844，无横向溢出及错误toast |
| 本站Console | PASS | console.json，0本站错误；3条chrome-extension主题警告单独保留 |
| 并行重启归因及范围保护 | PASS | runtime-reconciled.json；原verify失败保留说明，配置无漂移 |
| 视觉观察 | PASS | 查看实际桌面整体与390×844窗口及原尺寸顶部区域，无错误弹窗；本批无UI修改，不宣称新增布局或控件几何验收 |

浏览器加载资源为index-CzOZzb7X.js及index-_7elRJ8e.css；本批只改变Nacos配置，前端保持既有生产产物。截图为真实生产商品资料只读场景，未创建测试商品或订单。临时390×844覆盖已恢复2022×1017。

网络采集纠正：重载及视口切换后旧Network订阅出现空事件，空记录无效；重新启用监听后独立捕获最终桌面及窄屏序列，验收只引用有实际请求的证据。截图采集超时后，明确指定390×844并查看最终PNG，替换误得的局部图。经验仅保存C:/workspace/codex-selfimp/bobuy-resource-error-20261112/TASK_LEARNING_RECEIPT.md候选，未修改全局规则。

最终意图复核：用户报告的资源错误已由实际路由修复，受影响页面和窗口无重复弹错，真实故障反馈逻辑保持原实现。所有本批必需项已具备证据；AI任务处理器启用属于独立范围，本次保持当前关闭状态。
