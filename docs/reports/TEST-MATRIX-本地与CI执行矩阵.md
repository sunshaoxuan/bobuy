# 本地与CI测试执行矩阵

更新日期：2026-11-12。本矩阵取代2026-05-04版本。实际工作流位于 `.github/workflows/`；`ci.yml` 已在提交 `495c75a` 删除。历史报告中的 job、试运行数据与门禁结论只适用于对应历史版本。

## 自动执行

| 检查 | 触发与作用 | 裁定 |
| :-- | :-- | :-- |
| CodeQL Java / JavaScript / Actions | main代码push、面向main的PR、手动；纯Markdown与列明图片扩展名跳过 | 保留三语言分析与Java提取构建；JavaScript直接分析源码，移除额外npm安装与构建。PR新运行替代旧运行。main push保留默认分支安全结果 |
| Maven依赖扫描 | Maven POM、wrapper、`.mvn`、扫描runner或其工作流变化，以及手动触发 | 保留漏洞库更新、缓存、45分钟上限、失败传播及报告完整性；普通Java代码与SQL变化不重复扫描未变依赖 |
| Copilot cloud agent | GitHub平台动态工作流 | 由平台调度，仓库没有对应门禁文件。本次不修改平台权限或Agent设置 |

GitHub经典main保护接口返回 `Branch not protected`，仓库rulesets返回空列表。这表示未观察到仓库级必需status check，项目仍按下表验证受影响行为。工作流跳过记录为不适用；安全扫描成功不证明功能测试通过。

## 按变更范围执行

| 变更类型 | 必要验证及命令 | 可复用与边界 |
| :-- | :-- | :-- |
| 文档、CI与发布工具 | 引用、规则冲突、配置语法、受影响脚本正例与错误拒绝测试 | 无需产品全量、Docker产品镜像、真实AI、业务栈启停 |
| 前端局部行为或样式 | `npm test --prefix frontend -- <相关测试文件>`；发布产物运行一次 `npm run build --prefix frontend`；实际页面功能、console、网络、响应式和截图 | 共享入口、认证、路由或广泛状态变化按风险扩展测试范围。UI可见变化遵守当前视觉验收规则；本次用户禁用外部模型的要求优先 |
| 后端局部行为 | `mvn -f backend/pom.xml -Dtest=<相关测试类> test`；生产服务封装受影响时验证对应模块 | 共享基础变化或证据不足时执行后端全量。涉及BobbuyStore行为且需覆盖率时用 `python scripts/verify-backend-coverage.py` 一次完成verify；其90/70阈值保持 |
| 服务封装、依赖或启动配置 | 对应服务smoke、生产隔离配置、实际服务JAR与运行版本 | `backend`单体支持本地验收；生产运行封装服务，单体测试不能独立证明封装包正确。`build-service-images.sh --skip-package`仅在当前输入JAR已构建时使用 |
| 迁移与业务数据 | 版本化迁移、真实隔离PG中的相关升级/幂等性/约束/旧应用兼容与恢复验证 | H2与mock无法独立证明PG语义；禁止对业务库执行flyway:clean。仅新增参考档案遵循[轻量发布契约](../reference-data-release.md) |
| 发布应用或配置 | 当前生产基线、精确候选和产物、可执行恢复、受影响服务健康与页面；隔离配置变化运行 `python scripts/check-production-isolation.py` | 仅替换受影响服务。已有兼容应用回滚与异地备份按风险复用，快照、停写、恢复演练按具体破坏性风险选用 |
| AI识别或provider链路 | 本地fake/mock错误路径；真实集成仅针对相关功能、可用专用环境和已授权调用 | `.github/workflows/ai-release-evidence.yml`为手动专用流程；缺少外部AI不阻塞无关功能。`ReportOnly`与跳过样本不能证明真实集成通过 |

## 统一批次与证据

同一候选在实现完成后合并检查；有效结果绑定源码、依赖、配置、命令和相关环境。改动只使依赖这些输入的结果失效。一次构建的产物应供对应后续步骤使用；同一阶段的npm安装、Maven编译、镜像构建和全量测试避免重复。正在执行的检查持续跟踪。

全量测试用于共享基础、广泛行为变更或无法由针对性检查覆盖的风险，并记录原因。单纯新增文档或回执不使无关功能结果失效。测试全部跳过、零测试、缺失覆盖率文件和不完整扫描报告均不能声明为对应验收通过。

`prepare-ci-release-artifacts.py`及capture脚本含V27至V31等特定历史候选的白名单，当前schema已继续演进。它们保留用于历史复核，当前自动CI无调用；不得将其旧schema/固定class要求追加到新任务。需要复核历史artifact时运行对应测试。

`run-server-release-window.ps1`是2026-05-03的全服务发布窗口，已退役为只读预检。旧流程无条件要求AI、构建并启动全部基础设施、执行恢复演练；当前发布使用经审查的作用域操作与 `publish-production.py` 的显式分类。基础档案走reference-data；maintenance仅在具体风险需要时采用。历史发行operator保持原样，不作为新发布模板。

详见[本次完整重审报告](RELEASE-GATE-REVIEW-20261112.md)。
