# 新增基础档案的实际发布入口

项目入口为 `scripts/publish-production.py`。必须显式指定 `--mode`；旧的只有版本号的命令在任何读写操作之前退出。基础档案使用 `reference-data`，有具体维护风险的发布使用 `maintenance` 并提供 `--maintenance-reason`。旧的 `run-server-release-window.ps1` 已退役为只读 `-PrecheckOnly`，完整窗口即使提供快照开关和维护理由也会在远程调用前拒绝。恢复能力与当前受影响服务的发布检查依具体风险保留。

## 基础档案导入

将已审查的SQL、检查SQL、真实验收回执和计划放在同一根权限发布目录，例如 `/opt/bobuy/releases/20261113.1/`。执行者确认计划及其输入的摘要与实际已验收候选一致，然后运行：

```sh
python3 /opt/bobuy/scripts/publish-production.py 20261113.1 \
  --mode reference-data \
  --plan /opt/bobuy/releases/20261113.1/reference-data.json \
  --plan-sha256 <已审查计划文件的完整SHA256>
```

`reference-data.json` 必须包含且仅包含以下字段。所有 `path` 相对于发布目录，文件摘要使用原始字节的小写SHA256：

| 字段 | 要求 |
| --- | --- |
| kind | `ADDITIVE_REFERENCE_DATA` |
| source | 已验收源码的40位提交摘要 |
| scope | `tables` 为参考表名列表，`existingBusinessDataUnchanged` 和 `oldApplicationCompatible` 均为布尔true |
| sql | 一个或多个 `{path, sha256}`，按顺序执行版本化幂等SQL |
| checks | 每个检查为 `{path, sha256, table, expected}`，表必须在scope中，查询返回一个标量，每张参考表至少有一个检查 |
| acceptance | `{path, sha256}`，绑定真实受影响测试及必要门禁的验收回执 |
| offsiteBackup | `{status, recoveryLocation, evidence}`，status为VERIFIED时需恢复位置及 `{path, sha256}` 证据；UNKNOWN时另外两项为null，如实记录已有备份覆盖未知 |

验收回执包含 `result: "PASS"`、与计划相同的 `source`、`scope`、`sql`、`checks`，以及 `referenceData: {"idempotence":"PASS","oldApplicationCompatibility":"PASS","businessDataPreservation":"PASS"}`。字段来自真实验收，禁止为满足入口手填没有执行过的PASS。修改SQL、检查或作用域后，相关旧验收失效。

计划和SQL属于可信、已审查的可执行发布输入。摘要用于绑定审查结果，脚本不会通过SQL关键字推断业务安全，也不充当任意SQL沙箱。审查必须确认只操作声明的参考表，SQL无事务控制、psql元命令、会话设置或业务数据修改，检查SQL为仅查询目标档案的单标量SELECT。核对来源、数量、唯一性、父子关系、幂等性、锁影响和旧应用兼容性。Flyway管理的SQL保持版本和原字节，导入器不手写Flyway历史；后续应用迁移须能幂等接受已导入的表和种子。

实际执行只有一次 `docker exec ... psql`，导入和针对性检查在同一事务内，局部锁等待上限3秒、单语句上限120秒；检查不匹配时抛错回滚。该路径不运行dump、restore、停服务、全业务表指纹、nginx维护配置或环境版本切换。失败或连接结果不确定时写入 `INSPECT_REQUIRED`，不自动回灌、不自动重试。同一目录已有回执时拒绝重复激活；检查实际数据库和回执后，使用新的已审查发布目录重试幂等SQL。

成功状态 `REFERENCE_IMPORT_VERIFIED` 仅代表本次档案导入和针对性SQL验收完成。涉及应用代码时，仍使用经审查的兼容、限定服务发布操作，复用对应测试及必要门禁；不得为了部署读取接口回到默认全量快照/全局停写。实际应用版本、接口和页面验收另行完成。当前已上线档案无需重复导入。

## 维护路径及历史脚本

改写业务数据、破坏性结构变化、旧应用不兼容、实际锁冲突或恢复缺口需要记录具体风险后，才可明确选择维护路径。`--mode maintenance --maintenance-reason <具体理由>` 保留历史快照和停写流程，并记录maintenance-assessment.json。历史发布目录中的版本绑定operator保留审计和恢复用途，禁止复制后未经审查直接执行。定期备份脚本和隔离数据库的迁移演练具有独立目的，本次没有取消它们。

未来生产执行须核对 `/opt/bobuy/scripts/publish-production.py` 及同目录 `reference_data_release.py` 的实际摘要与本批安装回执相符，避免调用旧副本。验证范围及安装记录见 [脚本改进报告](reports/REFERENCE-RELEASE-SCRIPTS-20261112.md)。
