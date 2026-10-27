# ARCH-13: 全栈容器化部署方案

> 2026-10-27 候选更新：图片统一使用 PostgreSQL `bb_recommendation_image`；原对象存储服务已从候选代码与部署依赖移除。生产切换状态和回退步骤以 [PostgreSQL 18 升级与图片存储说明](../reports/POSTGRES18-STORAGE.md) 为准，不能直接把旧数据目录挂给18启动。


**生效日期**: 2026-04-18
**状态**: 执行中；2026-04-28 已按当前 Compose 拓扑修订

---

## 1. 架构目标

实现“一键部署、环境一致、边界清晰”的试运行部署架构。当前重点是固定主业务单体与服务外壳的职责边界，而不是在试运行阶段夸大尚未完成的数据与业务拆分。

## 2. 拓扑结构 (Topology)

所有容器加入 `bobbuy-net` (Bridge) 网络，实现通过内部服务名互访。

| 服务名 | 镜像 | 外部端口 | 内部端口 | 职责 |
| :--- | :--- | :--- | :--- | :--- |
| `gateway` | `nginx:alpine` | `127.0.0.1:80` | `80` | 对外入口，转发前端与 API |
| `frontend` | 项目 Dockerfile | - | `80` | 提供静态资源 |
| `gateway-service` | `Dockerfile.service` | - | `8080` | Spring Cloud Gateway 路由层，不写业务库 |
| `core-service` | `Dockerfile.service` | - | `8081` | 核心业务事实源与 Flyway 执行者 |
| `ai-service` | `Dockerfile.service` | - | `8082` | AI/OCR 服务外壳，复用共享代码，不独立持有业务事实 |
| `im-service` | `Dockerfile.service` | - | `8083` | 聊天 / WebSocket 服务外壳，复用共享代码 |
| `auth-service` | `Dockerfile.service` | - | `8084` | 登录 / JWT 服务外壳，不独立持有身份事实 |
| `ocr-service` | `bobbuy-ocr` | `127.0.0.1:8000` | `8000` | Python OCR 服务 |
| `postgres` | `postgres:18.6-alpine3.23` | `127.0.0.1:5432` | `5432` | 核心业务数据持久化 |
| `redis` | `redis:alpine` | `6379` | `6379` | 缓存与 Session 管理 |
| `rabbitmq` | `rabbitmq:3-management-alpine` | 内网 | `5672/61613` | AMQP / STOMP broker relay |
| `nacos` | `nacos/nacos-server:v2.3.2-slim` | `127.0.0.1:8848` | `8848` | 服务发现与配置 |

## 3. 持久化策略 (Persistence)

通过 Docker Volumes 确保数据在容器销毁后依然保留：

- `./data/postgres18` -> `/var/lib/postgresql/data`
- `./data/redis` -> `/data`
- `./data/rabbitmq` -> `/var/lib/rabbitmq`

## 4. 关键环境变量配置

后端服务容器的核心连接参数采用环境变量注入，避免在代码中硬编码：

```yaml
SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/bobbuy
SPRING_DATA_REDIS_HOST: redis
SPRING_RABBITMQ_HOST: rabbitmq
SPRING_PROFILES_ACTIVE: prod
SPRING_FLYWAY_ENABLED: true (仅 core-service)
BOBBUY_AI_LLM_MAIN_PROVIDER: auto
BOBBUY_AI_LLM_MAIN_URL: <显式填写>
BOBBUY_AI_LLM_CODEX_COMMAND: <默认留空，仅本地桌面场景启用>
```

## 5. 试运行阶段服务边界

- 默认路线采用 **主业务单体优先稳定**，详见 [ADR-01-试运行阶段服务边界决策](ADR-01-试运行阶段服务边界决策.md)。
- **主业务入口**：`backend`
- **事实源**：`core-service`
- **服务外壳**：`ai-service`、`im-service`、`auth-service`
- **可选服务**：`ocr-service`
- **后续拆分候选**：`ai-service`、`im-service`、`auth-service`

当前边界说明：

1. `bobbuy-core`、`bobbuy-ai`、`bobbuy-im`、`bobbuy-auth` 主要通过共享 `com.bobbuy` 包与 `ComponentScan excludeFilters` 形成部署外壳。
2. 除 `gateway-service` 外，当前多个服务仍共享同一个 PostgreSQL schema；这不是独立微服务数据所有权。
3. Compose 默认仍启动 `ai-service` / `im-service` / `auth-service`，原因是当前网关路由与回归测试尚未准备好安全降级为 optional/profile。
4. 只有在服务间鉴权、独立 schema、Tracing、SLO、拆分后 CI/CD 就绪后，才继续推进真实微服务拆分。

## 6. 当前部署边界

- 当前 Compose 更接近集成/试运行部署，不等同于生产高可用方案。
- Codex CLI 兜底只适合本地或私有 gateway；Linux 容器内不应假定存在 Codex 登录态。
- 当前已引入 Flyway；Compose 仅允许 `core-service` 执行 migration，其余服务默认禁用。
- 当前 `ai-service`、`im-service`、`auth-service` 仍属于共享代码驱动的服务外壳，不应写成“已经独立拆分完成”。
- Nacos、RabbitMQ、PostgreSQL 图片表、数据库密码与网络暴露策略已收敛到 `.env.template` + Compose，但 Secret Manager / TLS / HA / 监控告警仍需后续加固。

## 7. 安全性考量

- **内部网络保护**：宿主机端口默认仅绑定 `127.0.0.1`，核心业务通信走容器内网空间。
- **PostgreSQL 图片表 策略**：默认情况下，`bobbuy` 存储桶启用预览权限以便前端展示，但建议在生产环境配置 CDN 或反向代理鉴权。

---
**核准人**: Antigravity AI
**大纲审计状态**: 已核对 (Linear Integrity Verified)
