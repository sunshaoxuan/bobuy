# Bobuy task routing

For Costco email discovery, recommendation preparation, continuation or publication, use
`.agents/skills/costco-bobuy/SKILL.md` before acting. It preserves per-mail cases and
existing publication/denial receipts; it does not grant credentials or bypass approvals.
This project entry is local, not proof of installation in the personal Skills directory.
Do not change unrelated dirty files or start another Docker test stack for content work.

For Bobuy code development, integration and production delivery, read
`.agents/skills/bobuy-rapid-production/SKILL.md`; it is a workflow, not new authority.

## 新增基础档案的小功能发布

新增独立基础档案、查询或选择接口，且仅增加参考表和预制数据、保留已有业务数据、旧应用可继续运行时，使用版本化、幂等的SQL或脚本直接导入。核对数据来源、数量、唯一性、父子关系和重复执行结果；完成受影响测试、项目必要门禁及线上验收。用户已授权此类小功能测试通过后直接上线，无需再次等待常规发布指令。

这类发布默认复用现有异地流式备份，不额外创建发布前全量快照，不全局停写，不为核对新增档案扫描或聚合全部业务表。备份覆盖及恢复位置按现有运行证据核实，未知项如实记录。失败时优先回退兼容应用并保留新增参考表，或前向修复；禁止用旧快照覆盖已恢复写入的数据。

涉及改写或删除业务数据、破坏性结构变更、旧应用不兼容、真实锁冲突或恢复能力缺口时，按具体风险评估必要的备份或维护窗口，并记录依据及最小范围。发布技能和历史发布模板中的通用快照、停写步骤，按本节适用边界执行。
