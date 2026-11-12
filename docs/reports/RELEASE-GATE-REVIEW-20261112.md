# 测试与发布门禁重审

日期：2026-11-12。主Agent亲自审查，未调用Sub2API、外部模型或子Agent。

## 当前结论

已确认存在重复执行、过时强制规则和历史专用校验被误用的条件。提交历史可定位加入来源；现有证据不能确定用户当时是否知情，也不能证明有人恶意增加阻塞。

本次先发现原目录停留在 `20db3b4`，随后读取GitHub最新main `2086cd8d9f1cf8d815f4686c695fa191948727d8`，在隔离分支审查与修正。原目录大量未提交产品改动保持原样。以下“当前”均指该远端基线。

## 全部执行入口的裁定

| 入口或约束 | 来源与实际证据 | 裁定 |
| :-- | :-- | :-- |
| 默认BOBBuy CI | 2026-04-29的 `944e685` 对齐默认门禁；`495c75a` 于2026-11-10删除ci.yml。GitHub工作流列表也已无此流程 | 已删除的backend-test、frontend-quality、docker-build不再追加执行。修正README与测试矩阵中仍称每个PR必跑的错误 |
| CodeQL三语言 | 2026-04-30的 `83dd5b0` 已改JavaScript为none模式，后续仍留npm构建。实际run43196527673：Java构建89秒，JS安装构建21秒，Node准备7秒；全流程199秒 | 删除JS准备与构建，保留源码分析与Java提取。main与PR继续分析；删除copilot分支push重复入口。纯Markdown与列明图片变化跳过，PR过时运行可取消，main运行保留 |
| Maven依赖扫描 | run43175472941总46秒，扫描24秒。12.2.2、漏洞库缓存、失败传播和45分钟上限已在当前main存在 | 普通Java/SQL变化不改变依赖集合，收窄至全部POM、wrapper、.mvn与扫描工具输入。保留手动扫描及当前漏洞更新。依赖有新漏洞时可主动手动扫描，成功不代表漏洞已修复 |
| 旧全服务发布窗口 | `0c01af4` 于2026-05-03加入；11月仍保留强制AI、全服务up --build、事后pg_dump/restore、固定恢复库名、旧Nacos探针 | 删除重型执行体，保留只读PrecheckOnly。即使提供快照开关与理由也拒绝完整执行。旧流程会修改不相关基础设施，SQL恢复命令也未统一ON_ERROR_STOP，无法视为可信通用放行证据 |
| 通用Python发布器maintenance | database_fingerprint对所有表做有序JSON聚合，恢复库再做一次，内容表还做前后投影；读取图像bytea会扩大数据量。健康轮询每服务上限180秒，健康立即返回 | 保留显式维护路径内的恢复保护。普通兼容应用发布按现有作用域operator，禁止默认选维护路径。当前未读取生产数据库，实际耗时未知 |
| reference-data发布 | `479472c` 于2026-11-12加入显式分类、哈希绑定、一次事务psql与局部超时；已有真实PG演练回执 | 保留。只新增档案不额外快照、不全局停写、不全业务表指纹。用户已有轻量发布授权，不再增加常规批准步骤 |
| prepare-ci-release-artifacts与capture脚本 | 当前自动CI无调用；代码含固定V27/V28/V28.1/V30/V31转换与特定class/旧候选清单 | 保留为历史artifact复核工具，排除通用新发布门禁。不能把不支持当前schema解释为产品失败。精确产物来源与实际部署版本核对继续保留 |
| Maven后端与服务模块测试 | backend有135个Java测试资源文件，含fixture和手工测试。backend/pom将90/70覆盖率作用于BobbuyStore；verify-backend-coverage自身执行verify并检查新生成数据 | 认证、角色、并发、迁移和业务行为检查保留；局部改动运行相关测试，共享基础或广泛变化再运行全量。覆盖率不扩大到无关文档/UI任务，不先test再verify重复全量 |
| npm单测、构建和Playwright | src中120个test文件；实际历史811测试PASS。最近全量570.01秒、构建31.71秒；单个最慢测试文件12.62秒，不能从总耗时直接证明该测试无用 | 保留产品测试。收窄无关变更的执行范围，不删除真实行为用例。build含i18n、tsc、Vite与postbuild预渲染，发布当前前端产物需执行一次。共享栈、Playwright环境与相关截图继续复用 |
| AI手动workflow | 只有workflow_dispatch，连接专用后端和真实AI环境 | 保留相关功能验收，排除无关发布。当前未运行真实AI。历史硬编码runner路径与环境前提存在，独立运行前须核对；本批不把它扩大为默认门禁 |
| Git hooks与GitHub保护 | 本地hooks仅sample，core.hooksPath为空。GitHubmain经典保护返回Branch not protected，rulesets为空 | 未发现隐藏的仓库级required status check。平台Copilot动态工作流由GitHub调度，本次不修改其设置 |
| STD-06清场与五步铁律 | `1f73fad` 于2026-01-15强制调用std_06_integrated_test，要求每次Start/Verify/Test清场、全栈启动、彻底关闭；当前可用技能无该项 | 撤销缺失技能前置与无条件启停。按受影响服务、现有版本和冲突证据决定操作 |
| STD-01/03/08、README与旧矩阵 | 任意代码全量、任意评审强制采覆盖率、引用已删除CI、把历史结果称为当前结论 | 修订为范围矩阵、有效证据复用、合批一次检查；纯文档与CI不启动业务环境。历史报告保留原始事实 |

完整测试文件及脚本清单、工作流输入身份与远端运行摘要见本报告同级 `evidence/release-gate-review-20261112/`。清单覆盖全部候选测试入口；本次没有逐条执行全部产品测试，也不宣称每条测试均已证明有用。临时脚本、历史fixture和真正自动门禁分别标注。

## 性能证据与收益边界

历史依赖扫描1842秒来自2026-10-26报告；当前缓存后样本46秒，旧缺陷已修复，本次不重复记为新修复。CodeQL删除JS步骤可减少该job样本中的28秒工作，整个workflow关键路径当时为Java，不能承诺端到端同幅提速。文档/图片跳过和旧PR取消减少无关运行。前端570秒来自两个worker的特定现场，不能推断全部耗时来自断言，也未以关闭隔离、降低覆盖率或删用例来追求数字。

CodeQL JavaScript/TypeScript通过extractor直接分析，依据[GitHub官方分析准备文档](https://github.com/github/docs/blob/main/content/code-security/tutorials/customize-code-scanning/prepare-code-for-analysis.md)。依赖扫描缓存和失败传播语义按[Dependency-Check官方参数](https://dependency-check.github.io/DependencyCheck/dependency-check-maven/check-mojo.html)核对。本次不新增漏洞评分阈值。

## 验证与交付

本地验收通过：三个工作流YAML解析、17个触发正反例、PowerShell最终字节摘要绑定解析、模拟SSH只读预检、34个本地文档引用、Python语法及差异空白检查。reference发布回归10项中9项通过，1项真实PG测试因未启用明确本地opt-in跳过；SQL执行器未修改。原发布器9项与依赖扫描runner5项全部通过，真实检查命令和结果见 `local-validation.json`。触发模拟属于本地配置验证，GitHub真实执行另行记录。

当前没有产品功能或UI变化，无需产品全量与页面截图。本批未执行生产SQL、服务切换或AI请求。生产节点已安装的旧PowerShell脚本是否存在尚未核实，本批仓库退役不能宣称已修改远端节点。远端CI验收待提交后跟踪。
