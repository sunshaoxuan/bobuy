# ARCH-01: 平台技术架构选型

> 2026-10-27 候选更新：图片统一使用 PostgreSQL `bb_recommendation_image`；原对象存储服务已从候选代码与部署依赖移除。生产切换状态和回退步骤以 [PostgreSQL 18 升级与图片存储说明](../reports/POSTGRES18-STORAGE.md) 为准，不能直接把旧数据目录挂给18启动。


**生效日期**: 2026-01-13
**状态**: 草案
**引用**: [PROD-01-原始需求清单.md](PROD-01-原始需求清单.md)

---

## 1. 总体选型原则
- **高可用性**：支持微服务横向扩展，应对业务增长。
- **强一致性**：金融级支付与订单数据必须保证强一致。
- **AI 友好性**：后端架构需支持与 Python 生态（AI 模型常用语言）的平滑对接。

## 2. 后端架构：Spring Cloud 生态
采用 **Spring Cloud Alibaba** 作为核心套件，提供微服务治理。

- **核心框架**：Spring Boot 3.x
- **服务治理**：Nacos (注册中心 + 配置中心)
- **网关层**：Spring Cloud Gateway (承担限流、统一鉴权、日志切面)
- **服务调用**：OpenFeign + Sentinel (断路器与流量防护)
- **分布式事务**：Seata (针对跨服务的订单与结算一致性)

### 2.1 AI 与 Python 服务集成
由于 AI 能力（LLM 调度、OCR、图像搜索）在 Python 下实现更为高效，建议：
- **方案**：使用 **FastAPI** 编写 AI 侧微服务，通过 **Spring Cloud Sidecar** 或直接基于独立微服务注册至 Nacos 进行 Feign 调用。

## 3. 前端架构：React + Ant Design
- **核心框架**：React 18+ (使用 Functional Components + Hooks)
- **UI 组件库**：Ant Design 5.x (最新版本，提供流畅的 B 端/C 端交互)
- **状态管理**：Zustand 或 Redux Toolkit (根据复杂程度选型)
- **跨平台**：
  - Web 面向 PC 段。
  - **移动端**：使用 Ant Design Mobile 或基于 React Native 封装，确保手机端紧凑、易用的触控体验。

## 4. AI 智能 Agent 中台架构 (Core AI Infrastructure)
系统不再仅作为 LLM 的调用者，而是作为一个 **AI 原生 (AI-Native)** 驱动的 Agent 系统。

### 4.1 编排与治理 (Orchestration)
- **引擎选型**：引入 **Dify** 或 **LangGraph** 作为 Agent 流程编排台。
- **协议栈**：采用 **MCP (Model Context Protocol)** 实现模型与私有工具库（如搜索、库存查询）的标准连接。
- **双重审计 (Self-Correction)**：通过 Agent 驱动的多模型验证流（生成模型 vs 审计模型），确保 100% 格式对齐与逻辑准确性。

### 4.2 搜索 with 经验库 (Memory & Search)
- **外部检索**：通过 Google Search API (SerpApi) 与 Agent 协同，补全未知商品元数据。
- **本地经验库 (Experience Bank)**：利用 **Vector Database (如 Milvus/Pinecone)** 记录历史上模糊描述与正式商品的对应关系，实现“越用越聪明”。
- **暂存库核销**：针对现场发现的新商品，AI 自动完成“意向暂存库”与“正式商品库”的语义核销与属性迁移。

## 5. 数据存储与持久化

### 5.1 关系型与半结构化数据：PostgreSQL
- **核心优势**：原生支持 `JSONB` 类型，完美契合 IM 聊天记录及动态商品属性的存储。
- **扩展性**：支持存储过程及高级查询，可作为任务排队的基础存储方案。

### PostgreSQL 图片存储

图片字节、内容类型、所属商家、访问范围及去重哈希统一存入 `bb_recommendation_image`。公开商品图保持原公开接口；采购凭证使用鉴权接口，不能用公开商品图接口读取。数据库备份包含图片，不再单独依赖对象存储；恢复后校验行数、每行摘要、图片二进制摘要和权限隔离。详见 [PostgreSQL 18 升级与图片存储说明](../reports/POSTGRES18-STORAGE.md)。

## 6. 中间件与并发控制

### 6.1 缓存与状态管理：Redis
- **用途**：IM 消息实时推送掩码、用户 Session、高频商品缓存。
- **高级用法**：使用 **Redisson** 实现分布式锁，控制多商家抢单或库存扣减。

### 6.2 异步消息与任务队列：RabbitMQ (核心选型)
- **开源说明**：RabbitMQ 與 Kafka 均為成熟的開源免費方案。
- **選型決策**：採用 **RabbitMQ**。
- **理由**：
  - **靈活性與生態**：RabbitMQ 對於 Spring Boot 的支持極其成熟，具備豐富的交換機模式（Direct, Topic, Fanout），非常適合 IM 聊天的多樣化路由需求。
  - **運維成本**：相比 Kafka，RabbitMQ 的資源消耗更低，且具備直觀的管理界面，非常適合當前項目的快速迭代與容器化部署。
  - **STOMP 支持**：原生支持 STOMP 協議，能與 WebSocket 完美結合，實現 IM 消息的實時推送。
- **用途**：
  - IM 消息分佈式分發與 STOMP 實時推送。
  - AI 密集型任務（OCR、語義解析）的異步隊列處理。
  - 系統異步事件（如：訂單狀態流轉、緩存一致性）的通知中心。

### 6.3 验证网关 (Verification Gateway)
- **需求来源**：依据 [ARCH-04](ARCH-04-客户快速创建与管理详细设计.md)，敏感信息修改需强验证。
- **选型建议**：
  - **国内/国际短信/语音组件**：预留接口对接主流云通讯服务商。
  - **邮件服务**：后端集成邮件发送能力（如 AWS SES 或 SMTP 服务）。
  - **验证服务集成**：集成第三方验证码服务。
- **职责**：生成并校验多维度验证码，确保存储数据的真实性（详见 [ARCH-02](ARCH-02-参与者管理与身份认证详细设计.md)）。

### 6.4 聚合支付集成层 (Payment Service Library)
- **职责**：封装各支付渠道（Paypay, LinePay, Stripe, WeChat/Alipay）的 SDK 差异。
- **选型建议**：后端采用**工厂模式**解耦，前端通过统一的支付组件唤起原生或 H5 支付界面。
- **安全要求**：支持 PCI-DSS 合规性预留，敏感数据透传必须经过加密处理。

## 7. 开发质量与合规性 (STD 联动)
- 所有后端代码遵循 **STD-03-通用编程规范**。
- API 定义遵循 **STD-04-API 接口设计规范**。
- 数据库表设计遵循 **STD-05-数据库设计规范**，严禁使用存储过程处理核心业务逻辑，坚持逻辑抽象（Logic Schema）。

## 8. 部署与运维
- **容器化**：Docker + Kubernetes (K8s) 声明式部署。
- **CI/CD (定型)**：使用 **GitHub Actions** 自动化流水线。
  - **静态检查**：代码规范检测（Lint）。
  - **构建验证**：后端 Maven/Gradle 构建，前端 NPM 构建。
  - **集成测试**：自动运行核心业务流程测试。
