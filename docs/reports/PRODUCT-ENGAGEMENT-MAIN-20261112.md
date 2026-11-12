# 商品排序、热度与评分main合并

## 目标及边界

2026-11-12用户授权合并归档c680934及验收记录至main，保护其他会话分支和现有修改，避免重复生产发布。沿用[任务指导文档](../plans/PRODUCT-SORT-POPULARITY-20261111.md)。独立工作树engagement-main-20261112，分支codex-product-engagement-main-20261112，远端main初始e9b32e729f5501b8ed3af1d02ecad92b419096bc。

## 整合与验证方法

main已包含所有本批应用代码、V33、依赖、构建和工作流输入。将main原有账户、维护与参考价验收记录完整并入候选，Git自动合并，无冲突。合并差异限本批验收文档、截图、回执及验证脚本，生产运行版本不变。

归档历史和所有117份原生产证据保留原Git对象及工作树原始字节。使用scripts/verify-product-engagement-main-merge.py检查来源可达、运行输入等价、文档差异、主工作树状态与内容摘要、其他本地及远端分支保护，并调用原最终证据校验器。初始保护快照位于[main-merge/before.json](evidence/product-engagement-production/main-merge/before.json)。

合并门禁按当前版本实际配置：CodeQL在所有main PR及main push上触发，覆盖Java、JavaScript/TypeScript及Actions。Maven dependency-check仅在backend、根pom或其审计脚本/工作流路径变化时触发，本批不存在这些差异。AI release evidence为手动运行，无自动部署工作流；本任务不会手动执行它或任何生产发布器。GitHub实际查询main无保护规则和ruleset，仍要求上述适用检查成功后合并。

原生产后端666项零失败、24条件跳过，前端773项与增量检查、数据库并发及迁移、真实页面及视觉证据继续有效，详见[生产验收报告](PRODUCT-ENGAGEMENT-PRODUCTION-20261112.md)。应用输入未改变，本次不重复全量构建或生产页面写入。PR和main触发的正式CodeQL按其原流程执行，不调整或跳过。

## 冻结前检查及最终结果入口

预检PASS：[candidate-verification.json](evidence/product-engagement-production/main-merge/candidate-verification.json)绑定整合提交0b89c0b，确认原归档可达、117份证据字节、运行输入、其他分支和共享主工作树保护。完整合并快照中的reference-display/gemini-final.txt第3行带有main已存在的尾空格，该文件保留原始内容。本批相对main的git diff --check通过。

随后冻结提交21f370b的保护复核发现另一会话在10:27:09 JST独立提交editor-layout分支e4c3f83，main仍为原基线。检查引用日志和分支对应工作树，确认是原基线上的独立向前提交。初始保护快照保持原样，新增[并行变化观察记录](evidence/product-engagement-production/main-merge/concurrent-local-observations.json)精确绑定该次引用变化及日志动作；保护器仅认可这次已检查的变化，其他未知移动仍会拒绝。本批未写入或回退该分支，编辑器改动不纳入本次候选。预检回执中的“全部不变”仅对应0b89c0b检查时点。

本报告、预检回执和最终脚本一起冻结后，正式PR检查由现有GitHub工作流承担。关联PR可通过[本批分支的PR记录](https://github.com/sunshaoxuan/bobuy/pulls?q=head%3Acodex-product-engagement-main-20261112)查阅；PR说明保留最终head、门禁链接、合并SHA和main检查结果，作为无需改写已冻结候选的最终合并回执。PR状态、远端main身份、提交可达性及合并后检查共同决定结果。主任务指导文档与生产报告保留各阶段身份，不把先前生产发布等同于本次main合并。
