# PLAN-00: 任务看板总览

**最后更新**: 2026-10-25
**状态图例**: ✅ 已完成 | 🔄 进行中 | ⏳ 待开始

---

## 📊 整体进度总览

> 区域行程需求以 [PLAN-63](PLAN-63-区域送货行程与自动流程.md) 和 [REPORT-21](../reports/REPORT-21-区域送货行程验收.md) 为准，历史容量、固定路线、手工状态要求已被替代。此批属于本地候选，尚未发布生产。

> 历史实现基线以 [CURRENT-STATE-2026-04-28](../reports/CURRENT-STATE-2026-04-28.md) 为准。历史计划中的覆盖率、WebSocket、部署拓扑等描述如与当前基线冲突，以当前基线为准。

| 计划编号 | 计划名称 | 状态 | 完成度 | 核心目标 | 负责人 |
|------|------|--------|----------|----------|--------|
| [PLAN-01](PLAN-01-下一阶段开发任务规划.md) | MVP核心功能规划 | ✅ 已完成 | 100% | 补齐订单/行程核心链路 | 全栈团队 |
| [PLAN-02](PLAN-02-测试覆盖率提升计划.md) | 质量与债务专项 | ✅ 已完成 | 100% | 铁律攻坚 90/70 达标 | 全栈团队 |
| [PLAN-03](PLAN-03-第一周开发任务优先级与实施计划.md) | 第1周执行计划 | ✅ 已完成 | 100% | P0任务激活与质量红线 | 全栈团队 |
| [PLAN-04](PLAN-04-Sprint-3执行计划.md) | Sprint 3 执行计划 | ✅ 已完成 | 100% | 核心业务链路 E2E 验证 | 全栈团队 |
| [PLAN-05](PLAN-05-Sprint-4执行计划.md) | Sprint 4 执行计划 | ✅ 已完成 | 100% | 性能加固与生产就绪 | 全栈团队 |
| [PLAN-06](PLAN-06-订单重构实施方案.md) | 订单重构实施 | ✅ 已完成 | 100% | 详设驱动的头行架构重构 | 开发团队 |
| [PLAN-11](PLAN-11-APP响应式架构与Tablet适配实施方案.md) | 响应式架构与 Tablet 适配 | ✅ 已完成 | 100% | 三层分流与平板交互优化 | 全栈团队 |
| [PLAN-12](PLAN-12-商家仪表盘设计精修方案.md) | 商家仪表盘设计精修 | ✅ 已完成 | 100% | 多维指标统计与行程动态优化 | 开发团队 |
| [PLAN-14](PLAN-14-全球结算与支出管理升级提示词.md) | 全球对账与支出管理 V3.0 | ✅ 已完成 | 100% | 动态汇率与杂项费用核算 | 开发团队 |
| [PLAN-15](PLAN-15-客户结算与分润系统升级提示词.md) | 合伙人分润与物流追踪 V5.0 | ✅ 已完成 | 100% | 自动分润、凭证存储与物流集成 | 开发团队 |
| [PLAN-16](PLAN-16-客户端V2体验重塑提示词.md) | 客户端 V2.0 体验重塑 V6.0 | ✅ 已完成 | 100% | 日式极简视觉系统与实况流 | 开发团队 |
| [PLAN-17](PLAN-17-合伙人钱包与财务结算闭环提示词.md) | 钱包结算与财务闭环 V7.0 | ✅ 已完成 | 100% | 虚拟钱包、实付分润与对账历史 | 全栈团队 |
| [PLAN-20](PLAN-20-账单闭环与小票核销VNext.md) | 账单闭环与小票核销 VNext | ✅ 已完成 | 100% | 客户账单、小票复核、冻结治理 | 全栈团队 |
| [PLAN-21](PLAN-21-参与者档案与线下结算增强-VNext+1.md) | 参与者档案与线下结算增强 | ✅ 已完成 | 100% | 地址/社交档案、线下收款、差额结转 | 全栈团队 |
| [PLAN-22](PLAN-22-账本精算与配送履约闭环.md) | 账本精算与配送履约闭环 | ✅ 已完成 | 100% | 余额口径、待配送、拣货确认 | 全栈团队 |
| [PLAN-23](PLAN-23-冻结门禁与履约视图统一.md) | 冻结门禁与履约视图统一 | ✅ 已完成 | 100% | 冻结只读、拣货单一事实源 | 全栈团队 |
| [PLAN-24](PLAN-24-稳定上线差距收口优先级.md) | 稳定上线差距收口优先级 | ✅ 已完成 | 100% | 稳定上线差距已收口到服务器窗口复跑；剩余执行入口统一迁移到 PLAN-58 | 全栈团队 |
| [PLAN-25](PLAN-25-P0后端测试基线恢复开发提示词.md) | P0 后端测试基线恢复提示词 | ✅ 已完成 | 100% | `backend mvn test` 已恢复稳定全绿 | 全栈团队 |
| [PLAN-26](PLAN-26-P0前端测试基线恢复开发提示词.md) | P0 前端测试基线恢复提示词 | ✅ 已完成 | 100% | `frontend npm test` 已恢复稳定完成 | 全栈团队 |
| [PLAN-27](PLAN-27-P0上线验收矩阵与CI固化开发提示词.md) | P0 上线验收矩阵与 CI 固化提示词 | ✅ 已完成 | 100% | 默认 CI 与手动/专用门禁分层已对齐 | 全栈团队 |
| [PLAN-28](PLAN-28-P1认证与权限生产化开发提示词.md) | P1 认证与权限生产化提示词 | ✅ 已完成 | 100% | 已完成 JWT 登录、角色绑定与生产禁用 header auth | 全栈团队 |
| [PLAN-29](PLAN-29-P1数据库迁移治理开发提示词.md) | P1 数据库迁移治理提示词 | ✅ 已完成 | 100% | Flyway 基线已引入，core-service 负责试运行 schema 初始化 | 全栈团队 |
| [PLAN-30](PLAN-30-P1部署与配置收口开发提示词.md) | P1 部署与配置收口提示词 | ✅ 已完成 | 100% | Compose、Nacos、Spring、AI 与安全配置已收敛 | 全栈团队 |
| [PLAN-31](PLAN-31-P1-AI与OCR可靠性治理开发提示词.md) | P1 AI 与 OCR 可靠性治理提示词 | ✅ 已完成 | 100% | AI/OCR 失败、fallback、trace、重试与人工接管已可见 | 全栈团队 |
| [PLAN-32](PLAN-32-P2-微服务边界决策开发提示词.md) | P2 微服务边界决策提示词 | ✅ 已完成 | 100% | 已明确试运行阶段主业务单体与多服务外壳边界 | 全栈团队 |
| [PLAN-33](PLAN-33-P2-生产运维基础开发提示词.md) | P2 生产运维基础提示词 | ✅ 已完成 | 100% | 已补日志、基础指标、备份恢复与故障处置 Runbook | 全栈团队 |
| [PLAN-34](PLAN-34-P2-WebSocket与服务间鉴权收口开发提示词.md) | P2 WebSocket 与服务间鉴权收口提示词 | ✅ 已完成 | 100% | WebSocket 鉴权、服务间鉴权策略与 token 生命周期边界已收口 | 全栈团队 |
| [PLAN-35](PLAN-35-P2-服务间鉴权与服务壳Smoke测试开发提示词.md) | P2 服务间鉴权与服务壳 Smoke 测试提示词 | ✅ 已完成 | 100% | 内部调用最小信任边界与服务壳启动门禁已建立 | 全栈团队 |
| [PLAN-36](PLAN-36-P2-RefreshToken与会话生命周期治理开发提示词.md) | P2 Refresh Token 与会话生命周期治理提示词 | ✅ 已完成 | 100% | access token 刷新、登出撤销、轮换复用检测与前端会话恢复已完成 | 全栈团队 |
| [PLAN-37](PLAN-37-P2-浏览器Token防护与Refresh并发硬化开发提示词.md) | P2 浏览器 Token 防护与 Refresh 并发硬化提示词 | ✅ 已完成 | 100% | HttpOnly refresh cookie、CSRF、refresh 并发轮换边界已收口 | 全栈团队 |
| [PLAN-38](PLAN-38-P2-Playwright端到端试运行验收开发提示词.md) | P2 Playwright 端到端试运行验收提示词 | ✅ 已完成 | 100% | 浏览器 smoke、角色门禁、聊天与核心业务试运行验收已稳定 | 全栈团队 |
| [PLAN-39](PLAN-39-P1-Sample图片AI商品字段识别与档案落库优化提示词.md) | P1 Sample 图片 AI 商品字段识别与档案落库优化提示词 | ✅ 已完成 | 100% | 已建立 sample golden、Product.attributes 落库、字段级验证脚本与 AI 专用验收口径 | 全栈团队 |
| [PLAN-40](PLAN-40-P1-发版候选门禁与专用环境验收提示词.md) | P1 发版候选门禁与专用环境验收提示词 | ✅ 已完成 | 100% | 历史 NO-GO 收口任务，已由 REPORT-07、PLAN-50~55、REPORT-10/11/12 覆盖关闭 | 全栈团队 |
| [PLAN-41](PLAN-41-P0-发版阻断项处置与安全审计提示词.md) | P0 发版阻断项处置与安全审计提示词 | ✅ 已完成 | 100% | CodeQL high 与 dependency-check critical/high 已清零，剩余 medium/low 进入风险登记；由 REPORT-07 覆盖关闭 | 全栈团队 |
| [PLAN-42](PLAN-42-P0-专用环境发版证据执行提示词.md) | P0 专用环境发版证据执行提示词 | ✅ 已完成 | 100% | 专用环境证据口径已迁移到 REPORT-07 与 PLAN-58，历史 NO-GO 任务关闭 | 全栈团队 |
| [PLAN-43](PLAN-43-P0-NO-GO阻断项执行解阻提示词.md) | P0 NO-GO 阻断项执行解阻提示词 | ✅ 已完成 | 100% | CodeQL JS/TS build mode、重复触发、Maven dependency-check workflow 与 AI evidence workflow 已落地，并形成 `REPORT-07` NO_GO 复判 | 全栈团队 |
| [PLAN-44](PLAN-44-P0-真实环境放行证据与REPORT07复判提示词.md) | P0 真实环境放行证据与 REPORT-07 复判提示词 | ✅ 已完成 | 100% | 真实 AI/OCR、CodeQL、dependency-check 与 Compose 基础证据已由 REPORT-07/10/12 覆盖关闭 | 全栈团队 |
| [PLAN-45](PLAN-45-P0-CodeQL告警与真实放行证据闭环提示词.md) | P0 CodeQL 告警与真实放行证据闭环提示词 | ✅ 已完成 | 100% | CodeQL 3 个 high 已在 main 上标记 fixed；dependency-check artifact 已可下载并登记 `8 critical / 21 high / 19 moderate` | 全栈团队 |
| [PLAN-46](PLAN-46-P0-依赖高危处置与真实环境证据闭环提示词.md) | P0 依赖高危处置与真实环境证据闭环提示词 | ✅ 已完成 | 100% | Tomcat/Netty/FileUpload 与 pgjdbc 高危依赖已升级，Compose Maven PKIX 已解阻 | 全栈团队 |
| [PLAN-47](PLAN-47-P0-专用环境Nacos解阻与真实AI证据闭环提示词.md) | P0 专用环境 Nacos 解阻与真实 AI 证据闭环提示词 | ✅ 已完成 | 100% | Nacos、service jar、Compose 与真实 AI 证据已由 REPORT-07/09/10 覆盖关闭 | 全栈团队 |
| [PLAN-48](PLAN-48-P0-文档拉平与真实放行证据执行提示词.md) | P0 文档拉平与真实放行证据执行提示词 | ✅ 已完成 | 100% | 文档拉平、真实 AI、Compose health 与真实栈黑盒已由 REPORT-07/10/11/12 覆盖关闭 | 全栈团队 |
| [PLAN-49](PLAN-49-P0-双角色移动端黑盒走查提示词.md) | P0 双角色移动端黑盒走查提示词 | ✅ 已完成 | 100% | mock 与本地真实栈双角色移动端黑盒均已通过；服务器窗口复跑转入 PLAN-58 | 全栈团队 |
| [PLAN-50](PLAN-50-P0-真实AI放行链路与真实栈复验提示词.md) | P0 真实 AI/OCR 放行链路与真实栈复验提示词 | ✅ 已完成 | 100% | 真实 Codex Bridge provider、sample gate、字段级识别、真实 e2e:ai 已通过；结果见 REPORT-09 | 全栈团队 |
| PLAN-51 | 真实栈双角色全流程黑盒验收 | ✅ 已完成 | 100% | 本地 Compose 真实后端 API 下客户/采购者 `390x844` 与 `360x800` 黑盒任务流 `4 passed`；修复客户首页越权钱包请求导致的会话清空 | 全栈团队 |
| PLAN-52 | 功能清单与文档功能逐项对账 | ✅ 已完成 | 100% | 已形成 `REPORT-11` 功能承诺与验收矩阵，核心文档承诺均有验证入口或降级说明 | 全栈团队 |
| PLAN-53 | 可用性与移动端体验集中收口 | ✅ 已完成 | 100% | 客户与采购者移动端 P0/P1 卡点已修复，黑盒测试加固真实登录和真实栈模式 | 全栈团队 |
| [PLAN-56](PLAN-56-P0-服务器试运行证据封口与PLAN00关闭提示词.md) | 服务器试运行证据封口与 PLAN-00 关闭 | ✅ 已完成 | 100% | 历史封口计划已被 PLAN-58 接管并归档 | 全栈团队 |
| [PLAN-57](PLAN-57-P0-关闭剩余执行中任务与服务器放行复判提示词.md) | 关闭剩余执行中任务与服务器放行复判 | ✅ 已完成 | 100% | 历史放行复判计划已被 PLAN-58 接管并归档 | 全栈团队 |
| [PLAN-58](PLAN-58-P0-服务器输入接入与放行窗口执行提示词.md) | 服务器输入接入与放行窗口执行 | ✅ 已完成 | 100% | 本机 WSL 真实部署窗口已通过：Compose health、AI sample gate、真实 e2e:ai、双角色移动端黑盒、PostgreSQL / MinIO / Nacos 恢复演练全部闭环 | 全栈团队 |
| PLAN-54 | 空库上线、备份恢复与运维最小闭环 | ✅ 已完成 | 100% | 本地空库、seed、真实栈、备份恢复口径已闭环；服务器复跑转入 PLAN-58 | 全栈团队 |
| PLAN-55 | 放行复判与试运行包封版 | ✅ 已完成 | 100% | 试运行包封版复判口径已归档到 REPORT-07/13；服务器最终窗口转入 PLAN-58 | 全栈团队 |
| [PLAN-63](PLAN-63-区域送货行程与自动流程.md) | 区域送货与自动流程 | 验收中 | 按验收矩阵 | 两字段行程、自动状态、管理员归属与独立会话；功能及CI通过，临时文件清理受策略阻止 | Codex |
| CURRENT | 当前试运行收口 | ✅ 已完成 | 100% | 当前事实基线已拉平；动态服务器窗口状态由 PLAN-58 与 REPORT-13 维护 | 全栈团队 |
| [WALKTHROUGH-07](walkthrough.md) | V7.0 交付报告 | ✅ 已发布 | 100% | 自动结算闭环与钱包体系验证 | 架构师 |

| [PROD-03](../requirements/PROD-03-订单业务幂等与合并需求详细规格说明书.md) | 业务需求规约 | ✅ 已发布 | 100% | 独立业务合并与幂等判准 | 产品经理 |


### 📖 计划体系说明
- **PLAN-01 (战略)**: 业务功能的宏观路线图，定义 Sprint 1-3 的业务目标。
- **PLAN-02 (专项)**: 针对 AUDIT-04 提出的质量赤字，制定的中长期技术债务清偿方案。
- **PLAN-03 (战术)**: 历史执行入口。当前唯一执行入口为 PLAN-58；PLAN-24/40~58 以外的历史收口项已作为覆盖项关闭或归档。

---

## 📋 PLAN-01: 下一阶段开发任务规划

### Sprint 1（基础功能完备）- ✅ 已完成

#### 后端开发
- [x] **数据模型增强**
  - [x] 订单生命周期字段与状态更新时间
  - [x] 行程容量与剩余容量计算逻辑
  - [x] 基础费用字段（服务费、预计税费、货币类型）

- [x] **API 设计与实现**
  - [x] 订单状态流转接口（PATCH /api/orders/{id}/status）
  - [x] 行程可用容量校验与锁定接口（POST /api/trips/{id}/reserve）
  - [x] 指标接口补充（按状态统计订单数量）

- [x] **校验与错误码**
  - [x] 统一错误响应结构（ApiResponse + ErrorCode）
  - [x] 参数校验（Java Validation API）

#### 前端开发
- [x] **表单完善**
  - [x] 行程创建表单（日期、容量、状态）
  - [x] 订单创建表单（服务费、币种）

- [x] **状态可视化**
  - [x] 订单状态标签（Ant Design Tag）
  - [x] 行程状态标签

- [x] **数据校验提示**
  - [x] 表单必填与范围校验
  - [x] 关键字段展示说明

---

### Sprint 2（流程闭环与可观测）- ✅ 已完成

#### 后端开发
- [x] **基础审计日志**
  - [x] 订单状态变化日志（AuditLogService）
  - [x] 行程状态变化日志

- [x] **可观测性**
  - [x] 健康检查接口（HealthController）
  - [x] 指标接口（MetricsController）
  - [x] 全量 API 统一日志规范化实现 (通过 RequestLoggingInterceptor 架构锁定)

#### 前端开发
- [x] **流程动作按钮**
  - [x] 订单状态流转按钮 (✅ 已发布)
  - [x] 行程状态变更入口 (✅ 已发布)

- [x] **日志与提醒**
  - [x] 订单状态变更记录展示 (通过单元测试验证逻辑)
  - [x] 异常提醒与空态引导 (✅ 已全量覆盖)

---

### Sprint 3（质量与验收）- ✅ 已完成

#### 后端开发
- [x] **测试用例攻坚**
  - [x] 单元测试铁律达标 (Backend Line 92%, Branch 76%)
  - [x] 接口集成测试 (OrderController 100% 覆盖)
- [x] **架构与可靠性**
  - [x] 全量 API 日志规范化 (拦截器全量覆盖)
  - [x] 并发场景验证 (reserveTripCapacity 锁机制验证)

- [x] **端到端验收列表**
  - [x] MVP 核心链路操作清单 (Playwright 已覆盖)
  
---

## 📋 PLAN-02: 测试覆盖率提升计划

### Phase 1: 测试基础设施建设 - ✅ 已完成
**截止日期**: 2026-01-16

- [x] **后端测试配置**
  - [x] 配置 JaCoCo 插件 (pom.xml)
  - [x] 验证覆盖率报告生成 (47.4% 基线已建立)

- [x] **前端测试配置**
  - [x] 安装测试依赖 (Vitest + Testing Library)
  - [x] 创建 vitest.config.ts
  - [x] 创建测试工具文件 (setup.ts)

---

### Phase 2: 后端单元测试补充 - ✅ 已完成

- [x] **BobbuyStore 完整测试**
  - [x] 订单 CRUD 测试 (100% 覆盖)
  - [x] 订单状态流转测试 (100% 覆盖)
  - [x] 行程容量测试 (含并发验证)
  - **当前状态**: 行覆盖率 **100%** (已覆盖 Optional/异常分支)

- [x] **AuditLogService 测试**
  - [x] 日志记录测试 (100% 覆盖)
  - **当前状态**: 行覆盖率 100%

---

- [x] **Orders 组件测试**
  - [x] 表单渲染测试
  - [x] 表单提交测试
  - [x] 成功/失败消息测试
  - **当前状态**: 行覆盖率 83% (红线达标)

- [x] **Trips 组件测试**
  - [x] 表单渲染测试
  - [x] 容量计算测试

- [x] **i18n 功能测试**
  - [x] 默认语言测试
  - [x] 语言切换测试
  - [x] 翻译正确性测试

---

- [x] Sprint 3 Phase 1 (E2E & Integration): `OrderController` 100% 覆盖, 日志规范化完成。

- [x] **并发控制修复**
  - [x] 添加 synchronized 锁机制
  - [x] 补充并发测试用例 (✅ 验证通过)

---

## 🎯 里程碑与验收标准

### 里程碑 1: Sprint 1 完成 ✅
**成果**: 
- 数据模型完整
- API 接口实现
- 前端表单可用
- I18n 支持完整

### 里程碑 2: 测试基础设施就绪 ✅
**验收标准**:
- [x] JaCoCo 报告可生成
- [x] Vitest 可运行测试
- [x] 覆盖率工具配置完成

### 里程碑 3: 测试覆盖率基线达标 ✅
**验收标准**:
- [x] 后端核心 (BobbuyStore) **100%** (目标 ≥90%)
- [x] 分支覆盖率 **87%** (目标 ≥70%)
- [x] 前端页面 (Orders.tsx) ≥60% (实际 83%)
- [x] 并发漏洞修复完成

---

## 🔴 阻塞问题与技术债务

### 高优先级（P0）
1. ✅ **测试覆盖率不足** - 来源: AUDIT-04
   - 现状: 后端 92%/76%, 前端 83% (Orders)
   - 状态: ✅ **已闭环 (铁律锁定)**

2. ✅ **未配置覆盖率工具** - 来源: AUDIT-04
   - 状态: ✅ 已集成 JaCoCo & Vitest

### 中优先级（P1）
3. ✅ **并发控制缺失** - 来源: AUDIT-01
   - 状态: ✅ 已通过 synchronized 修复

4. ✅ **Controller 层无测试** - 来源: AUDIT-04
   - 影响: API 回归风险高
   - 状态: 已由后端集成测试矩阵覆盖，后续新增 Controller 继续随功能补测

### 低优先级（P2）
5. ✅ **E2E 测试缺失** - 来源: AUDIT-01
   - 状态: ✅ Playwright 基线已通过 (AUDIT-07)

---

## 📈 进度统计

### 总体完成度
- **PLAN-01 Sprint 1**: 100% ✅
- **PLAN-01 Sprint 2**: 100% ✅
- **PLAN-01 Sprint 3**: 100% ✅
- **PLAN-05 Sprint 4**: 100% ✅ (已由后续 PLAN-24~58 的生产就绪收口覆盖)

### 测试覆盖率进度
| 模块 | 当前 | 铁律目标 | 长期目标 |
|------|------|-------------|----------|
| 后端 - Line | **92%** | 90% | 95% |
| 后端 - Branch | **76%** | 70% | 85% |
| 前端 - Line | **81.6%** | 60% | 75% |

### 技术债务清偿进度

> 2026-05-02 修正：PLAN-25 到 PLAN-39 已完成，PLAN-43 到 PLAN-50 已把 CodeQL、Maven dependency-check artifact、AI evidence workflow、服务镜像预构建、Nacos/Compose 基础健康、真实 sample/e2e 执行路径、Codex Bridge provider 与双角色移动端 mock 黑盒落地并形成 `REPORT-07` / `REPORT-09`。最新 main 默认 CI 成功，CodeQL main push 成功，Maven dependency-check 已降至 `0 critical / 0 high / 13 medium / 2 low`；本轮补齐 LLM 空响应兜底、OpenAI-compatible content 数组解析、Compose/Nacos Codex Bridge 配置传递、服务器禁用不可执行 Codex CLI 的保护、Codex Bridge JSON 请求体、样例字段归一化与相似商品匹配修正。当前剩余风险集中在真实旧库 adoption、真实栈移动端复验与长期架构项。
- **已解决**: 9/9（100%）
  - ✅ 前端提交逻辑
  - ✅ I18n 支持
  - ✅ 审计日志与追溯 (`trace_id`)
  - ✅ API 文档与契约
  - ✅ 测试覆盖率 (90/70 铁律达标)
  - ✅ 并发控制安全性
  - ✅ Controller 集成测试
  - ✅ Playwright smoke 试运行验收
  - ✅ AI 商品字段级识别、结构化落库与 sample golden 验证脚本

- **仍需风险登记**:
  - sample 验证脚本已修复 `basePrice -> price` 字段别名漂移与失败非零退出码；PLAN-50 真实 `/api/ai/onboard/scan` sample gate 已通过，`3 PASS / 0 FAIL / 0 SCAN_FAIL`。
  - Refresh token 轮换已通过 `findByTokenHashForUpdate` 悲观写锁与 `AuthRefreshConcurrencyIntegrationTest` 收口；旧的“并发互斥缺失”review finding 已不再适用于当前 main。
  - CodeQL JS/TS `build-mode` 已从 `manual` 修正为 `none`，PR #60 最新 CodeQL run `25148614578` 三个 matrix 均通过；重复 `push` / `pull_request` 触发已在 PR 分支收口。
  - 2026-05-01 merge 后 CodeQL main run `25198280107` 成功，code scanning API 显示 3 个 high alert 均为 `fixed`。
  - Maven dependency-check main run `25217516557` 成功，artifact `dependency-check-report`（id `6750657743`）可下载；复扫结果为 `0 critical / 0 high / 13 medium / 2 low`，pgjdbc high 已清零。
  - `Dockerfile.service` 已改为复制宿主机构建好的 jar，不再在 service 镜像内执行 Maven；该路线需要固定 `mvn -f pom.xml -DskipTests package -pl ... -am` 作为 Compose service build 前置门禁。
  - 真实 compose 栈当前不再被 Maven PKIX、Nacos cgroup v2 / `ProcessorMetrics`、`nacos-init` CRLF、gateway health 或 OCR `/health` 阻塞；PLAN-50 已用临时环境变量注入可用 Codex Bridge，真实 AI sample gate 已通过，证据见 `docs/reports/evidence/ai-onboarding-real-sample-plan50-2026-05-02.*`。
  - 最新 main `BOBBuy CI` run `25192905348` 成功；早前 frontend image `ECONNRESET` 已通过 `npm ci` 与 npm fetch retry 收口。
  - Codex Bridge provider 已加入 LLM fallback 路径；当前代码已支持主 LLM 空响应后切换到 bridge，并能解析 OpenAI-compatible `message.content` 字符串/数组响应。PLAN-50 进一步修复 bridge JSON 请求体，避免远端拒绝非标准 JSON body。
  - `npm run e2e:ai` AI 真实视觉链路已在本地真实栈通过，`2 passed`。
  - `REPORT-07` 已复判为 `GO_INTERNAL_TRIAL`；真实 AI/OCR PASS 证据与本机 WSL 放行窗口已固化，PLAN-00 不再保留执行中任务。
  - OAuth/SSO、mTLS/service mesh、独立 schema、契约测试、拆分后独立 CI/CD 仍属于后续架构任务。

---

## 🚀 下一步行动 (本周重点)

**历史收口任务已关闭；2026-10-25 新批次 PLAN-63 单独维护区域送货需求与候选验证。PLAN-58 本机 WSL 放行窗口结果已写入 [REPORT-13](../reports/REPORT-13-服务器试运行证据与PLAN00关闭报告.md)，REPORT-07 复判为 `GO_INTERNAL_TRIAL`。后续如迁移到外部 Linux 服务器，应复用 PLAN-58 脚本作为运维复跑，而不是重新打开历史 PLAN-40~58。**

1. **试运行前手动门禁**:
   - [x] PLAN-58 本机 WSL 放行窗口：见 [REPORT-13](../reports/REPORT-13-服务器试运行证据与PLAN00关闭报告.md)，`release_window=pass`。
   - [x] 服务器/本机部署窗口 Compose health、真实 AI sample、真实 e2e:ai、真实栈双角色黑盒、PostgreSQL / MinIO / Nacos 备份恢复演练已一次性闭环。
   - [x] 历史 NO-GO 收口计划 PLAN-40/41/42/44/47/48/49 已由 REPORT-07、PLAN-50~55、REPORT-10/11/12 覆盖关闭
   - [x] 后端：`cd backend && mvn test`
   - [x] 前端：`cd frontend && npm test && npm run build`
   - [x] 浏览器 smoke：`cd frontend && npm run e2e`，当前口径 `46 passed / 2 skipped`
   - [x] Compose 配置渲染：`docker compose config`
   - [x] AI 商品字段级 sample golden、结构化落库与验证脚本：见 [PLAN-39](PLAN-39-P1-Sample图片AI商品字段识别与档案落库优化提示词.md) 与 [REPORT-03](../reports/REPORT-03-AI商品字段识别样例验证报告.md)
   - [x] AI sample 专用实扫：`pwsh scripts/verify-ai-onboarding-samples.ps1 -IncludeNeedsHumanGolden -AuthToken <agent-token>` 已通过，`3 PASS / 0 FAIL / 0 SCAN_FAIL`
   - [x] AI 真实视觉：`cd frontend && RUN_AI_VISION_E2E=1 npm run e2e:ai` 已通过，`2 passed`
   - [x] 双角色移动端真实栈黑盒：mock、本地 Compose 真实后端 API、PLAN-58 WSL 放行窗口均已通过

2. **风险登记 / 独立门禁**:
   - [x] CodeQL main run `25198280107` 已成功，3 个 high alert 均为 fixed
   - [x] Maven dependency-check main run `25217516557` 已成功且 artifact `6750657743` 可下载；critical/high 已清零
   - [x] PostgreSQL / MinIO / Nacos 备份恢复演练：PLAN-58 WSL 放行窗口已通过，PostgreSQL 恢复库 `flyway_rows=3`、`bb_product=4`，MinIO 探针对象与 Nacos 配置归档均通过
   - 真实告警平台、集中日志、自动化备份、服务级 SLO：后续运维增强项，不作为当前 PLAN-00 关闭口径

3. **长期演进（不纳入当前 PLAN-00 关闭口径）**:
   - OAuth / SSO
   - mTLS / service mesh
   - 独立 schema / 数据所有权
   - 契约测试
   - 拆分后独立 CI/CD

---

**备注**: 
- 本看板作为索引每日更新，**具体任务描述以各子计划文档和 CURRENT STATE 为准**。
- PLAN-00 当前无 `执行中` / `进行中` 任务；后续新增工作应另开新计划，不再复用历史 NO-GO 收口计划。
