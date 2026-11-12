# Bobuy task routing

For Costco email discovery, recommendation preparation, continuation or publication, use
`.agents/skills/costco-bobuy/SKILL.md` before acting. It preserves per-mail cases and
existing publication/denial receipts; it does not grant credentials or bypass approvals.
This project entry is local, not proof of installation in the personal Skills directory.
Do not change unrelated dirty files or start another Docker test stack for content work.

For Bobuy code development, integration and production delivery, read
`.agents/skills/bobuy-rapid-production/SKILL.md`; it is a workflow, not new authority.

## 需求与测试范围的强限制

1. **只能修改哪里测试哪里。** 实现前在任务文档列明用户授权范围、本批修改点，以及每项修改对应的最小验证集合。验证限于本次修改和有具体依赖关系的直接受影响行为。
2. **禁止自主扩展功能。** 调价数据、定时任务等局部需求不得自行扩展为调价单维护后台、独立管理页面、额外工作流或整套管理能力。新增独立功能须由用户明确授权。
3. **禁止无依据全量测试。** 局部逻辑、局部UI、文案、文档和配置改动，不得顺带执行全项目测试、所有前端或后端测试、全部E2E、全服务构建或全栈启停。禁止用“保险起见”“顺便回归”或历史模板作为理由。
4. **扩大范围先举证。** 确需扩大验证时，必须先在当前任务文档记录失效输入、具体跨模块影响、针对性检查不足的证据、拟运行检查及最小必要范围。全量仅在证据确实覆盖全局时执行；没有这些依据不得启动。
5. **候选收敛后合并验证。** 开发中只运行必要的快速针对性检查；本批代码、配置与需求收敛后，合并执行相关验证。相同有效输入的PASS直接复用，进行中的运行继续跟踪。失败后只重跑修复影响的检查；再次扩大须重新满足上一条。
6. **按变更类型验收。** 纯文档与规则修改只做准确性、引用、冲突和相关静态检查。UI检查限于修改区域及直接关联交互、必要视口和失败实例。既有自动CI被触发时跟踪该次运行，不在本地重复预跑同一集合。
7. 本节优先于历史文档、技能或发布模板中无条件全量、逐子任务全量以及无关流程捆绑要求。必要的安全、权限和数据保护验证同样须明确对应本次变更的风险与作用范围。

## 新增基础档案的小功能发布

新增独立基础档案、查询或选择接口，且仅增加参考表和预制数据、保留已有业务数据、旧应用可继续运行时，使用版本化、幂等的SQL或脚本直接导入。核对数据来源、数量、唯一性、父子关系和重复执行结果；完成受影响测试、项目必要门禁及线上验收。用户已授权此类小功能测试通过后直接上线，无需再次等待常规发布指令。

这类发布默认复用现有异地流式备份，不额外创建发布前全量快照，不全局停写，不为核对新增档案扫描或聚合全部业务表。备份覆盖及恢复位置按现有运行证据核实，未知项如实记录。失败时优先回退兼容应用并保留新增参考表，或前向修复；禁止用旧快照覆盖已恢复写入的数据。

涉及改写或删除业务数据、破坏性结构变更、旧应用不兼容、真实锁冲突或恢复能力缺口时，按具体风险评估必要的备份或维护窗口，并记录依据及最小范围。发布技能和历史发布模板中的通用快照、停写步骤，按本节适用边界执行。
