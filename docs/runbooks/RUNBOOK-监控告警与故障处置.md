# RUNBOOK: 监控告警与故障处置

> 2026-10-27 候选更新：图片统一使用 PostgreSQL `bb_recommendation_image`；原对象存储服务已从候选代码与部署依赖移除。生产切换状态和回退步骤以 [PostgreSQL 18 升级与图片存储说明](../reports/POSTGRES18-STORAGE.md) 为准，不能直接把旧数据目录挂给18启动。


**适用范围**: 内部 / 小范围试运行最小化生产运维基础  
**不适用范围**: Prometheus/Grafana、集中日志平台、云告警平台、自动扩缩容

---

## 1. 目标与边界

本 Runbook 只覆盖试运行阶段最小可用的运维口径：

1. 能快速找到日志入口。
2. 能手工检查健康检查与关键指标。
3. 能用统一阈值判断是否需要告警 / 升级。
4. 能按固定故障清单执行首查、缓解、恢复与事后记录。

当前仍未完成的边界：

- 真实告警平台接入
- Prometheus / Grafana / 云监控
- 集中日志系统
- RabbitMQ / Redis / Nacos 自动指标采集
- 服务级 SLO / Error Budget

---

## 2. 日志入口

### 2.1 服务日志命令

```bash
cd /home/runner/work/bobbuy/bobbuy

docker compose logs -f gateway
docker compose logs -f gateway-service
docker compose logs -f core-service
docker compose logs -f ai-service
docker compose logs -f im-service
docker compose logs -f auth-service
```

### 2.2 关键日志字段

#### HTTP / API

- `method`
- `path`
- `status`
- `cost` / `latency`
- `trace_id`
- `user`
- `role`
- `internal_service`

当前来源：

- `backend/src/main/java/com/bobbuy/api/RequestLoggingInterceptor.java`
- `X-Trace-Id` 会回写到响应头，便于前端 / 网关 / 应用日志对齐。

示例口径：

```text
[INFO] POST /api/orders status=201 cost=42ms trace_id=... user=agent role=AGENT internal_service=-
```

#### AI / OCR

- `provider`
- `activeProvider`
- `model`
- `stage`
- `latencyMs`
- `errorCode`
- `fallbackReason`
- `attemptNo`
- `inputRef`
- `outputRef`
- `recognitionStatus`

当前来源：

- AI 上架 trace：`AiProductOnboardingService`
- 小票识别 trace：`ProcurementReceiptRecognitionService`
- 人工复核 traceHistory：`ProcurementHudService`
- LLM provider 初始化 / 切换日志：`LlmGateway`

### 2.3 日志安全红线

禁止写入日志：

- JWT / Bearer token
- refresh token
- CSRF token
- `X-BOBBUY-SERVICE-TOKEN`
- STOMP `CONNECT` header 中的 Bearer token
- 用户密码
- 完整小票图片 base64
- 敏感票据原文的整段转储

---

## 3. 健康检查与人工巡检

### 3.1 网关与应用入口

```bash
curl -fsS http://127.0.0.1/api/actuator/health
curl -fsS http://127.0.0.1/api/actuator/health/readiness
curl -fsS http://127.0.0.1/health
```

### 3.2 Compose / 基础设施巡检

```bash
cd /home/runner/work/bobbuy/bobbuy
docker compose ps
docker compose exec postgres pg_isready -U "${POSTGRES_USER:-bobbuy}" -d "${POSTGRES_DB:-bobbuy}"
curl -fsS http://127.0.0.1:${NACOS_HOST_PORT:-8848}/nacos/v1/console/health/readiness
docker compose exec rabbitmq rabbitmq-diagnostics -q check_running
docker compose exec redis redis-cli ping
curl -fsS http://127.0.0.1:${OCR_HOST_PORT:-8000}/docs >/dev/null
```

### 3.3 服务健康口径

| 对象 | 健康口径 | 首查命令 |
| :-- | :-- | :-- |
| gateway nginx | `http://127.0.0.1/health` / `docker compose ps` | `docker compose logs --tail=100 gateway` |
| gateway-service | `/actuator/health/readiness` + `GatewayServiceSmokeTest` | `docker compose logs --tail=100 gateway-service` |
| core-service | `/actuator/health/readiness` + `CoreServiceSmokeTest` | `docker compose logs --tail=100 core-service` |
| ai-service | `/actuator/health/readiness` + `AiServiceSmokeTest` | `docker compose logs --tail=100 ai-service` |
| im-service | `/actuator/health/readiness` + `ImServiceSmokeTest` | `docker compose logs --tail=100 im-service` |
| auth-service | `/actuator/health/readiness` + `AuthServiceSmokeTest` | `docker compose logs --tail=100 auth-service` |
| postgres | `pg_isready` | `docker compose logs --tail=100 postgres` |
| rabbitmq | `rabbitmq-diagnostics -q check_running` | `docker compose logs --tail=100 rabbitmq` |
| nacos | `/nacos/v1/console/health/readiness` | `docker compose logs --tail=100 nacos` |
| redis | `redis-cli ping` | `docker compose logs --tail=100 redis` |
| ocr-service | 容器 running + 本地探活 | `docker compose logs --tail=100 ocr-service` |

---

## 4. 最小指标集

### 4.1 当前轻量指标入口

```bash
curl -fsS -H "Authorization: Bearer <agent-token>" http://127.0.0.1/api/metrics
```

当前 `/api/metrics` 提供：

- 用户 / 行程 / 订单总数
- 订单状态分布
- endpoint 请求次数
- endpoint 延迟 `p95` / `p99`
- `4xx` / `5xx` endpoint 计数
- 登录失败次数（`POST /api/auth/login` 的 4xx）
- 全局 HTTP `5xx` 比率

### 4.2 需要人工统计 / 查询的指标

| 指标 | 当前口径 | 获取方式 |
| :-- | :-- | :-- |
| HTTP 5xx 数量 / 比率 | `/api/metrics` | 查看 `http5xxByEndpoint`、`overall5xxRate` |
| 登录失败次数 | `/api/metrics` | 查看 `loginFailureCount` |
| 订单创建 / 更新失败 | endpoint 级 `5xx` | 查看 `/api/orders` 相关 `http5xxByEndpoint` + `core-service` 日志 |
| 账单 / 钱包关键操作失败 | endpoint 级 `5xx` + 审计日志 | 查看 `/api/procurement`、`/api/financial/audit`、wallet 相关日志 |
| AI / OCR 成功率 | trace + 识别状态 | 查询 `RECOGNIZED` / `FAILED_RECOGNITION` / `PENDING_MANUAL_REVIEW` 日志与小票记录 |
| AI fallback 次数 | trace 中 `fallbackReason` | 查询 `fallbackReason` / `activeProvider` |
| 人工复核待处理数 | 小票识别状态 | 查看采购小票列表中的 `PENDING_MANUAL_REVIEW` / `PENDING_REVIEW` |
| PostgreSQL 连接失败 | 日志 | 搜索 `core-service` / `ai-service` / `im-service` / `auth-service` 中 datasource / connection error |
| PostgreSQL 图片表 上传失败 | 日志 | 搜索 `ImageStorageService` / `PostgreSQL 图片表` error |
| RabbitMQ 连接失败 | 日志 | 搜索 AMQP / STOMP connection error |
| WebSocket 连接 / 断开异常 | `im-service` / `core-service` 日志 | 搜索 websocket / stomp / broker relay / chat forbidden / invalid websocket access token |
| `/internal/**` 401 | gateway-service / 对应服务日志 | 搜索 internal service token / forged internal header / unauthorized internal endpoint |

> 当前不强行引入 Prometheus；AI/OCR、RabbitMQ、Redis、Nacos 仍以日志 + Runbook 巡检为主。

---

## 5. 告警规则

每条告警都包含：触发条件、影响范围、首查命令、缓解动作、升级条件。

### 5.1 服务不可用

- **触发条件**: 任一 readiness 连续 3 次失败或 `docker compose ps` 显示服务非 `healthy/running`
- **影响范围**: 对应业务入口不可用
- **首查命令**:
  ```bash
  docker compose ps
  docker compose logs --tail=200 gateway-service core-service ai-service im-service auth-service
  ```
- **缓解动作**: 修正配置 / 依赖后重启单服务；必要时按已验证版本回滚
- **升级条件**: 15 分钟内未恢复，或同时影响 gateway + core-service

### 5.2 登录异常

- **触发条件**: `/api/metrics` 中 `loginFailureCount` 短时间明显突增，或用户集中反馈 401/403
- **影响范围**: 所有登录 / 鉴权请求
- **首查命令**:
  ```bash
  docker compose logs --tail=200 auth-service core-service gateway-service
  grep -n "BOBBUY_SECURITY_JWT_SECRET" /home/runner/work/bobbuy/bobbuy/.env
  ```
- **缓解动作**: 检查 JWT secret、时间漂移、header auth 是否被误开、网关路由是否正常
- **补充说明**: HTTP 401 现在会最多自动 refresh 并重试一次；若 refresh 也失败，前端会清理登录态并要求重新登录
- **补充说明**: 若只在 refresh/logout 看到 403，优先检查 `bobbuy_csrf_token` cookie、`X-BOBBUY-CSRF-TOKEN` header，以及 `BOBBUY_SECURITY_REFRESH_COOKIE_SECURE` / `SameSite` 是否与当前访问方式一致
- **补充说明**: WebSocket `/ws` 已改为依赖同一 access token；若只有聊天实时能力异常，也按登录链路检查 refresh 是否成功与 STOMP 鉴权失败
- **补充说明**: 若只影响 `/internal/**` 或 `core-service -> ai-service` 这类内部调用，还需同步检查 `BOBBUY_SECURITY_SERVICE_TOKEN` 是否在 gateway-service 与下游服务一致
- **补充说明**: 若问题只在浏览器 smoke / 手动门禁出现，先打开 `frontend/playwright-report/index.html` 或 CI 上传的 `playwright-e2e-artifacts`，优先查看失败用例的 trace、video、screenshot
- **升级条件**: 所有角色均无法登录，或 token 验证持续失败超过 10 分钟

### 5.3 订单 / 账单 / 钱包 5xx

- **触发条件**: `/api/metrics` 中 `/api/orders`、`/api/procurement`、wallet 相关 endpoint 出现持续 `5xx`
- **影响范围**: 下单、账单确认、线下结算、钱包分润
- **首查命令**:
  ```bash
  docker compose logs --tail=200 core-service
  ```
- **缓解动作**: 识别是 migration、数据库、对象存储还是数据脏状态；优先保护账务正确性，必要时只读止血
- **升级条件**: 涉及财务写入失败、重复写入或账单金额异常

### 5.4 AI / OCR 降级

- **触发条件**: `fallbackReason` 突增、`activeProvider=unconfigured`、`FAILED_RECOGNITION` 集中出现
- **影响范围**: AI 上架、小票识别效率下降，需要人工接管
- **首查命令**:
  ```bash
  docker compose logs --tail=200 ai-service ocr-service
  ```
- **缓解动作**: 检查 `BOBBUY_AI_LLM_MAIN_URL` / `BOBBUY_AI_LLM_EDGE_URL` / `BOBBUY_OCR_URL`，切回人工复核
- **升级条件**: AI/OCR 故障已影响订单 / 账单主链路，或人工队列无法消化

### 5.5 数据库异常

- **触发条件**: PostgreSQL 连接失败、Flyway migration 失败、应用启动卡在 datasource
- **影响范围**: 核心业务全部不可写
- **首查命令**:
  ```bash
  docker compose exec postgres pg_isready -U "${POSTGRES_USER:-bobbuy}" -d "${POSTGRES_DB:-bobbuy}"
  docker compose logs --tail=200 postgres core-service
  ```
- **缓解动作**: 恢复 PostgreSQL、验证磁盘空间、停止重复迁移；旧库 adoption 先备份再评估 baseline
- **升级条件**: 数据损坏风险、需要恢复备份、或 migration 已部分执行

### PostgreSQL 图片存储

图片字节、内容类型、所属商家、访问范围及去重哈希统一存入 `bb_recommendation_image`。公开商品图保持原公开接口；采购凭证使用鉴权接口，不能用公开商品图接口读取。数据库备份包含图片，不再单独依赖对象存储；恢复后校验行数、每行摘要、图片二进制摘要和权限隔离。详见 [PostgreSQL 18 升级与图片存储说明](../reports/POSTGRES18-STORAGE.md)。

### 5.7 RabbitMQ 异常

- **触发条件**: broker relay / STOMP 连接失败、消息堆积、聊天实时推送异常
- **影响范围**: 聊天实时性下降，可能退化为轮询 / 刷新
- **首查命令**:
  ```bash
  docker compose exec rabbitmq rabbitmq-diagnostics -q check_running
  docker compose logs --tail=200 rabbitmq im-service
  ```
- **缓解动作**: 重启 broker 或 `im-service`，确认 STOMP 插件与凭据
- **补充说明**: 若 broker 正常但只有部分用户收不到实时消息，继续检查 JWT 过期、`chat forbidden` 与错误重连是否已被前端降级为 REST 刷新
- **升级条件**: 聊天消息丢失、持续堆积、或 gateway / im-service 同时异常

---

## 6. 故障处置清单

### 6.1 服务启动失败

- **现象**: `docker compose ps` 显示 `exited` / `unhealthy`
- **首查命令**: `docker compose logs --tail=200 <service>`
- **常见原因**: env 缺失、依赖未就绪、端口冲突、migration 失败
- **缓解步骤**: 修配置 -> 单服务重启 -> 再跑 readiness
- **回滚 / 恢复**: 切回最近已验证镜像 / `.env`
- **事后记录**: 记录失败服务、根因、恢复时间

### 6.2 core-service migration 失败

- **现象**: `core-service` 启动失败并出现 Flyway 报错
- **首查命令**: `docker compose logs --tail=200 core-service`
- **常见原因**: 旧库未备份、schema 漂移、错误开启 baseline
- **缓解步骤**: 停止继续重试；确认是否旧库 adoption；优先备份
- **回滚 / 恢复**: 恢复备份库或新库验证，不直接覆盖线上库
- **事后记录**: 记录 migration 版本、库状态、处置结果

### 6.3 JWT secret 缺失

- **现象**: 登录不可用 / 应用启动失败 / 鉴权全部 401
- **首查命令**: `grep -n "BOBBUY_SECURITY_JWT_SECRET" .env`
- **常见原因**: `.env` 未填、环境变量覆盖为空
- **缓解步骤**: 生成并回填 secret，重启相关服务
- **回滚 / 恢复**: 恢复最近已验证 `.env`
- **事后记录**: 记录缺失原因与 secret 轮换影响范围

### 6.4 header auth 被误开

- **现象**: 公网 / 共享环境可通过 header 提权，或文档与环境不一致
- **首查命令**:
  ```bash
  grep -n "BOBBUY_SECURITY_HEADER_AUTH_ENABLED" .env
  docker compose logs --tail=100 core-service auth-service
  ```
- **常见原因**: 误用 dev 配置
- **缓解步骤**: 立即改为 `false` 并重启服务
- **回滚 / 恢复**: 恢复上一个已验证配置
- **事后记录**: 记录暴露窗口与审计检查结果

### 6.4A WebSocket 鉴权被拒绝

- **现象**: 页面可打开聊天，但实时消息不更新；日志出现 websocket auth 失败 / `chat forbidden`
- **首查命令**:
  ```bash
  docker compose logs --tail=200 im-service core-service
  ```
- **常见原因**: access token 过期、前端未重新登录、customer 订阅了非本人订单/行程上下文
- **缓解步骤**: 重新登录刷新 access token；确认当前账号只访问本人订单/行程聊天；不要开启 header auth 或改用 query token 绕过
- **回滚 / 恢复**: 保持 REST 刷新路径可用，必要时临时按既有手工刷新路径运行
- **事后记录**: 记录受影响账号、具体上下文、是否因 token 过期或权限越界导致

### 6.5 PostgreSQL 不可用

- **现象**: `pg_isready` 失败、核心接口 5xx
- **首查命令**: `docker compose logs --tail=200 postgres core-service`
- **常见原因**: 容器退出、磁盘满、连接数异常
- **缓解步骤**: 恢复 postgres 容器 / 磁盘后，再确认 `core-service`
- **回滚 / 恢复**: 按备份恢复 Runbook 恢复到新库验证
- **事后记录**: 记录丢失窗口、恢复点、验收结果

### PostgreSQL 图片存储

图片字节、内容类型、所属商家、访问范围及去重哈希统一存入 `bb_recommendation_image`。公开商品图保持原公开接口；采购凭证使用鉴权接口，不能用公开商品图接口读取。数据库备份包含图片，不再单独依赖对象存储；恢复后校验行数、每行摘要、图片二进制摘要和权限隔离。详见 [PostgreSQL 18 升级与图片存储说明](../reports/POSTGRES18-STORAGE.md)。

### 6.7 RabbitMQ 不可用

- **现象**: WebSocket / STOMP 异常，聊天推送中断
- **首查命令**: `docker compose logs --tail=200 rabbitmq im-service`
- **常见原因**: broker 未启动、插件未启用、凭据错误
- **缓解步骤**: 恢复 RabbitMQ，再确认 `im-service`
- **回滚 / 恢复**: 必要时退回仅 REST / 页面刷新补偿路径
- **事后记录**: 记录消息是否丢失或仅延迟

### 6.8 Nacos 不可用

- **现象**: 服务发现 / 配置加载异常，应用启动或路由异常
- **首查命令**: `docker compose logs --tail=200 nacos gateway-service core-service`
- **常见原因**: Nacos 容器异常、配置漂移、初始化失败
- **缓解步骤**: 恢复 Nacos，重新执行配置初始化
- **回滚 / 恢复**: 恢复 `infra/nacos/config/*.yaml` 与导出快照
- **事后记录**: 记录配置差异与恢复来源

### 6.9 AI / OCR 不可用

- **现象**: `unconfigured`、`FAILED_RECOGNITION`、fallback 激增
- **首查命令**: `docker compose logs --tail=200 ai-service ocr-service`
- **常见原因**: 模型 URL 不可达、OCR 服务异常、provider 配置缺失
- **缓解步骤**: 切人工补录 / 人工复核；恢复 provider 配置
- **回滚 / 恢复**: 切回最近已验证 AI / OCR 配置
- **事后记录**: 记录人工接管量与失败类型

### 6.10 WebSocket 聊天不可用

- **现象**: 实时消息不推送、页面反复断开重连
- **首查命令**: `docker compose logs --tail=200 im-service gateway gateway-service rabbitmq`
- **常见原因**: `/ws` 路由、RabbitMQ STOMP、broker relay、网络代理
- **缓解步骤**: 恢复 `/ws` 路由与 broker relay；必要时提示用户刷新
- **回滚 / 恢复**: 退回 REST 持久化 + 手动刷新补偿
- **事后记录**: 记录消息延迟 / 丢失范围

### 6.11 前端空白页或 API 401 / 403

- **现象**: 页面空白、菜单缺失、核心 API 被拒绝
- **首查命令**:
  ```bash
  docker compose logs --tail=200 frontend gateway gateway-service auth-service core-service
  ```
- **常见原因**: 前端构建问题、JWT secret / token 问题、角色判断异常、网关路由错误
- **缓解步骤**: 先确认前端 bundle 与 `/api/auth/me`；再查网关与鉴权链路
- **回滚 / 恢复**: 回滚前端镜像 / token 配置
- **事后记录**: 记录受影响角色、页面与 API

---

## 7. 升级与事后记录

满足以下任一条件需要升级处理：

1. 核心交易链路（登录、下单、账单、钱包）连续 15 分钟不可用。
2. 涉及数据库恢复、对象存储恢复或 migration 回滚。
3. 有疑似财务错误、数据丢失或权限失控。
4. 需要临时关闭 AI/OCR 或聊天实时能力超过 30 分钟。

事后记录至少包含：

- 发现时间
- 影响范围
- 首个告警 / 反馈来源
- 根因
- 缓解动作
- 恢复时间
- 后续改进项
