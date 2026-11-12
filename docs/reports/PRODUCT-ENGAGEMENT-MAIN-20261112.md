# 商品排序、热度与评分main合并

## 目标及边界

2026-11-12用户授权合并归档c680934及验收记录至main，保护其他会话分支和现有修改，避免重复生产发布。沿用[任务指导文档](../plans/PRODUCT-SORT-POPULARITY-20261111.md)。独立工作树engagement-main-20261112，分支codex-product-engagement-main-20261112，远端main初始e9b32e729f5501b8ed3af1d02ecad92b419096bc。

## 整合与验证方法

main已包含所有本批应用代码、V33、依赖、构建和工作流输入。将main原有账户、维护与参考价验收记录完整并入候选，Git自动合并，无冲突。合并差异限本批验收文档、截图、回执及验证脚本，生产运行版本不变。

归档历史和所有117份原生产证据保留原Git对象及工作树原始字节。使用scripts/verify-product-engagement-main-merge.py检查来源可达、运行输入等价、文档差异、主工作树状态与内容摘要、其他本地及远端分支保护，并调用原最终证据校验器。初始保护快照位于[main-merge/before.json](evidence/product-engagement-production/main-merge/before.json)。

合并门禁按当前版本实际配置：CodeQL在所有main PR及main push上触发，覆盖Java、JavaScript/TypeScript及Actions。Maven dependency-check仅在backend、根pom或其审计脚本/工作流路径变化时触发，本批不存在这些差异。AI release evidence为手动运行，无自动部署工作流；本任务不会手动执行它或任何生产发布器。GitHub实际查询main无保护规则和ruleset，仍要求上述适用检查成功后合并。

原生产后端666项零失败、24条件跳过，前端773项与增量检查、数据库并发及迁移、真实页面及视觉证据继续有效，详见[生产验收报告](PRODUCT-ENGAGEMENT-PRODUCTION-20261112.md)。应用输入未改变，本次不重复全量构建或生产页面写入。PR和main触发的正式CodeQL按其原流程执行，不调整或跳过。

## 当前状态

候选完成整合，等待文档/证据检查、冻结、PR门禁及精确head合并。最终以实际PR状态、远端main身份、提交可达性和合并后检查判定，未完成前不宣称main合并通过。
