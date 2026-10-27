# BOBBuy

2026-10-22 本地增量：公开手机商城与 `/admin` 商家入口，尚未发布到线上。
需求见 [PROD-05](docs/requirements/PROD-05-公开商城与商客关系.md)，验收见
[REPORT-15](docs/reports/REPORT-15-手机商城本地验收.md)。
使用 `./scripts/local-test.ps1 start` 启动唯一 `bobuy-local` 容器组，
客户入口 `http://127.0.0.1:18080`，商家入口 `/admin`，测试收件箱 `http://127.0.0.1:18025`。
`status` 和 `stop` 操作同一组。此环境使用本地演示数据，邮件仅在 Mailpit 收取。

2026-10-21 deployment: repository `sunshaoxuan/bobuy`, site `https://bobuy.cc`.
See [production deployment](docs/production-deployment.md) and
[deployment acceptance](docs/deployment-task.md) for the current release,
isolation boundary, credentials location and remaining product limits.

BOBBuy 当前是一套以 **Spring Boot + React + PostgreSQL/MinIO + WebSocket(STOMP) 实时聊天 + AI/OCR 辅助识别** 为基础的代购协作系统。

当前实现基线以 [CURRENT-STATE-2026-04-28](docs/reports/CURRENT-STATE-2026-04-28.md) 为准；旧 Release / Plan 文档若与该基线冲突，以当前基线为准。

## 当前真实能力
- **订单 / 行程管理**：行程、订单、批量状态流转、客户侧订单查询。
- **采购 HUD**：利润看板、额外支出、物流追踪、手工对账、客户账单汇总、财务审计流水、伙伴钱包。
- **参与者档案登记**：支持维护电话、邮箱、备注、默认地址与社交账号登记信息。
- **客户账单闭环**：客户可按行程查看 `businessId` 级账单、订单行详情、实采数量、差额说明，并完成“确认收货 / 确认账单”；`COMPLETED` / `SETTLED` 后确认动作自动只读。
- **线下收款与差额结转**：采购端可登记现金 / 转账 / 其他线下收款；当前余额、历史结转余额、本次应收/已收/待收统一仅统计进入结算语义的订单，排除 `NEW` / `CANCELLED` / 无效草稿单。
- **结算冻结治理**：行程进入 `COMPLETED` / `SETTLED` 后，后端与前端统一拦截客户确认、线下收款、小票重新识别/人工复核、拣货确认等会改变财务/履约/确认状态的动作，仅保留查询、导出、审计查看。
- **采购小票核销工作台 V1**：支持上传多张采购小票，保存原图/缩略图/上传时间/处理状态；优先调用真实 AI 识别小票内容，并在 AI 不可用时降级为规则回退结果；展示 AI / RULE_FALLBACK、识别状态、provider/model/stage/attempt trace、置信度、复核状态，并保留人工核销审计。
- **账本精算修正**：历史余额排除取消单、未生效单、未来无效单；线下收款方式后端强校验为 `CASH / BANK_TRANSFER / OTHER`。
- **配送准备与地址清单**：采购 HUD 与客户端账单展示默认地址摘要；支持待配送客户列表与地址 / 经纬度 CSV 导出。
- **拣货确认闭环**：`/procurement` 与 `/picking` 共用 reviewed receipt + picking checklist 单一数据源，按 `businessId` 展示 `PENDING_DELIVERY` / `READY_FOR_DELIVERY`，保留 `SHORT_SHIPPED` / `ON_SITE_REPLENISHED` / `SELF_USE` 标签，并在冻结后统一只读。
- **聊天协作**：聊天已升级为 REST 持久化 + WebSocket(STOMP) 实时推送；客户侧聊天保持“订单上下文优先，Trip 次级筛选”。
- **AI 商品上架**：支持 OCR-first 识别、LLM 结构化、供应商规则、来源治理、既有商品匹配与人工确认；返回 provider/model/stage/latency/error/fallback trace，并在失败时支持人工补录为草稿；结构化字段（净含量/单位价格/包装规格/储存提示）会进入 `Product.attributes` JSONB 并可在前端继续修正。
- **数据库迁移治理**：已引入 Flyway；`backend/src/main/resources/db/migration` 提供 PostgreSQL 基线 schema，`backend` / `core-service` 通过 migration 初始化空库，生产/试运行不再依赖 Hibernate `ddl-auto=update`。
- **LLM 兜底**：主文本 LLM 支持 `auto` 路由，优先 Ollama，不可用时可切换到 OpenAI-compatible `codex-bridge`，最后才使用本地 Codex CLI；服务器生产环境不假定 Codex CLI 可用。
- **移动端真实栈验收**：客户与采购者核心路径已在本地 Compose 真实后端 API 下通过 `390x844` 与 `360x800` 黑盒任务流；发现并修复客户首页越权请求采购者钱包导致 401 清空登录态的问题。
- **空库试运行口径**：当前确认无历史业务数据，旧库 adoption 不适用；上线验收改为空库 Flyway、seed、真实栈黑盒与 PostgreSQL / MinIO / Nacos 备份恢复演练。

## 当前未实现 / 不宣称
- 消息队列驱动的非聊天业务闭环
- 真实第三方支付网关
- 社交 OAuth 登录
- 真实地图路径规划 / 实时配送追踪
- 无人值守 AI 小票识别

## 技术栈
- **Backend**: Spring Boot 3 / Spring Cloud / Nacos / OpenFeign / Resilience4j / Spring Security / Spring Data JPA
- **Frontend**: React 18 / Ant Design / Vite / Vitest / Playwright
- **Storage**: PostgreSQL 18.6 (image bytes included)

## 试运行阶段服务边界

- 默认路线采用 **主业务单体优先稳定**，详见 [ADR-01-试运行阶段服务边界决策](docs/architecture/ADR-01-试运行阶段服务边界决策.md)。
- **主业务入口**：`backend`（开发、测试、Flyway migration 源码入口）。
- **事实源**：试运行部署中由 `core-service` 承载核心业务事实源，并独占 Flyway migration。
- **服务外壳**：`ai-service`、`im-service`、`auth-service` 当前继续复用 `backend` 共享代码、共享 PostgreSQL schema 与共享安全配置，不是独立业务事实源。
- **可选服务**：`ocr-service` 属于 AI/OCR 增强能力依赖；不可用时系统按既有 fallback / 人工复核路径降级。
- **后续拆分候选**：`ai-service`、`im-service`、`auth-service`；在服务间鉴权、独立 schema、Tracing、SLO、独立 CI/CD 到位前，不继续深拆。
- 当前默认 Compose 仍保留 `ai-service` / `im-service` / `auth-service`；虽已补最小服务壳 smoke test，但在独立 schema、契约测试与拆分后 CI/CD 到位前，仍不安全降级为 optional/profile。

## 试运行运维入口

- 试运行部署：[`docs/runbooks/RUNBOOK-试运行部署.md`](docs/runbooks/RUNBOOK-试运行部署.md)
- 监控告警与故障处置：[`docs/runbooks/RUNBOOK-监控告警与故障处置.md`](docs/runbooks/RUNBOOK-监控告警与故障处置.md)
- 备份恢复演练：[`docs/runbooks/RUNBOOK-备份恢复演练.md`](docs/runbooks/RUNBOOK-备份恢复演练.md)
- 本次运维基线执行报告：[`docs/reports/REPORT-02-生产运维基础执行报告.md`](docs/reports/REPORT-02-生产运维基础执行报告.md)

## 模块 / 服务定位

| 模块 | 当前定位 | 试运行职责 |
| :-- | :-- | :-- |
| `backend` | 主业务入口 | 核心 Controller / Service / Repository / Flyway / 测试 |
| `bobbuy-common` | 共享依赖层 | 公共依赖、配置、DTO/响应模型 |
| `bobbuy-core` | 核心业务服务外壳 | `core-service` 部署入口，承载共享核心业务事实源 |
| `bobbuy-ai` | AI 服务外壳 | `ai-service` 部署入口，承载 AI/OCR 相关接口但不独立持有业务事实 |
| `bobbuy-im` | IM 服务外壳 | `im-service` 部署入口，承载聊天/WebSocket 相关接口但共享数据库 |
| `bobbuy-auth` | 认证服务外壳 | `auth-service` 部署入口，承载登录/JWT 相关接口但不独立持有身份事实 |
| `bobbuy-gateway` | 路由层 | `gateway-service`，只负责路由与健康检查 |

完整职责矩阵、风险与验证记录见 [REPORT-01-试运行服务边界执行报告](docs/reports/REPORT-01-试运行服务边界执行报告.md)。

## 快速开始

1. 复制部署模板并填写必改项：
   ```bash
   cd /home/runner/work/bobbuy/bobbuy
   cp .env.template .env
   ```
2. 至少修改：
    - `BOBBUY_SECURITY_JWT_SECRET`
    - `BOBBUY_SECURITY_SERVICE_TOKEN`
    - `POSTGRES_PASSWORD`
    - `RABBITMQ_DEFAULT_PASS`
3. 校验并启动：
    ```bash
    cd /home/runner/work/bobbuy/bobbuy
    docker compose config
    bash scripts/build-service-images.sh
    docker compose up -d --build
    ```

默认仅绑定到宿主机 `127.0.0.1`：

- Gateway / Frontend: `http://127.0.0.1`
- Gateway API: `http://127.0.0.1/api`
- Nacos Console: `http://127.0.0.1:8848/nacos`

详细试运行步骤见 [docs/runbooks/RUNBOOK-试运行部署.md](docs/runbooks/RUNBOOK-试运行部署.md)。

### 配置优先级

1. 容器环境变量（`docker compose` / `.env`）
2. Nacos 配置
3. `application-{profile}.properties`
4. `application.properties`

### 试运行安全默认值

- Compose 服务固定 `SPRING_PROFILES_ACTIVE=prod`。
- `BOBBUY_SECURITY_JWT_SECRET` 必须显式填写，模板不再提供可直接上线的默认值。
- `BOBBUY_SECURITY_REFRESH_TOKEN_TTL_SECONDS` 默认 604800 秒（7 天）；`BOBBUY_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED` 默认 `true`。
- refresh cookie 默认使用 `bobbuy_refresh_token`、`Path=/api/auth`、`HttpOnly=true`、`SameSite=Lax`；公网 HTTPS 部署必须把 `BOBBUY_SECURITY_REFRESH_COOKIE_SECURE=true`。
- CSRF double-submit token 默认使用 `bobbuy_csrf_token` cookie + `X-BOBBUY-CSRF-TOKEN` header；当前由 Spring Security 对 cookie-backed `/api/auth/refresh` 与 `/api/auth/logout` 强制校验。
- `BOBBUY_SECURITY_HEADER_AUTH_ENABLED` 默认 `false`，公网 / 共享部署不得开启。
- `BOBBUY_SECURITY_SERVICE_TOKEN` 必须显式填写；留空时不会信任内部服务 header，`/internal/**` 也不会放行。
- WebSocket `/ws` 必须通过 STOMP `CONNECT` header `Authorization: Bearer <access-token>` 建立连接；未登录或 token 无效时前端退回既有 REST 刷新路径。
- `BOBBUY_SEED_ENABLED` 默认 `false`；demo 账号仅限本地演示。
- `core-service` 为唯一 Flyway migration 执行者，其余服务固定禁用 Flyway。
- 服务器部署推荐 Ollama / 私有兼容 gateway；如使用个人 Codex 订阅桥接服务，请配置 `BOBBUY_AI_LLM_MAIN_PROVIDER=codex-bridge` 或保持 `auto` 作为 Ollama 不可用时的兜底，并使用 `BOBBUY_AI_LLM_CODEX_BRIDGE_URL` 指向 OpenAI-compatible `/v1` endpoint。
- `BOBBUY_AI_LLM_CODEX_BRIDGE_API_KEY` 仅允许用于本机 `.env` / secret manager；如需把密文配置提交到仓库，使用 `scripts/encrypt-ai-secret.ps1` 生成 `BOBBUY_AI_LLM_CODEX_BRIDGE_SECRET_*`，并把 `BOBBUY_AI_SECRET_MASTER_PASSWORD` 保留在服务器环境变量中，不得写入 git。
- `BOBBUY_AI_LLM_MAIN_URL` / `BOBBUY_AI_LLM_EDGE_URL` / `BOBBUY_OCR_URL` 留空时，前端会进入人工接管/重试路径，日志与响应 trace 会显示 `unconfigured`。

### 数据库迁移

- Compose 试运行固定使用 PostgreSQL 15，避免继续承受 PostgreSQL 18 与 Flyway 10.15.2 的兼容性提示风险。
- Flyway migration 目录：`backend/src/main/resources/db/migration`
- 空库初始化（本地 PostgreSQL / Docker Compose `postgres`）：
  ```bash
  cd backend
  mvn -Dflyway.url=jdbc:postgresql://localhost:5432/bobbuy -Dflyway.user=bobbuy -Dflyway.password=bobbuypassword flyway:migrate
  ```
- 现有非空库首次纳管前必须先备份；仅在确认库结构与 `V1__baseline_schema.sql` 对齐后，才可显式设置 `BOBBUY_FLYWAY_BASELINE_ON_MIGRATE=true` 做一次性基线登记。
- Docker / Nacos 短期约定由 `core-service` 负责执行 migration，避免多服务并发迁移竞态。

### 网关路由
- `/api/auth/**` → `auth-service`
- `/api/chat/**` → `im-service`
- `/api/ai/**` → `ai-service`
- `/ws` / `/ws/**` → `im-service`
- 其余 `/api/**` → `core-service`

说明：

- 上述路由目标当前是**服务外壳**，并非已完成独立数据所有权的微服务。
- `auth-service` 通过专门路由承载 `/api/auth/**`；`core-service` 仍是其余业务 API 的默认事实源。

## 当前认证方案

- **登录模型**：后端提供 `POST /api/auth/login`、`POST /api/auth/refresh`、`POST /api/auth/logout` 与 `GET /api/auth/me`；登录响应返回 HMAC JWT access token，并通过 `Set-Cookie` 下发 opaque refresh token。
- **refresh token 策略**：refresh token 为高熵 opaque token；服务端仅保存 SHA-256 hash，不保存明文；浏览器端改为 `bobbuy_refresh_token` HttpOnly cookie（默认 `Path=/api/auth`、`SameSite=Lax`、生产建议 `Secure=true`）；默认 TTL 7 天，可通过 `BOBBUY_SECURITY_REFRESH_TOKEN_TTL_SECONDS` 调整。
- **CSRF 防护**：`/api/auth/refresh` 与 `/api/auth/logout` 采用 double-submit CSRF token；后端设置非 HttpOnly `bobbuy_csrf_token` cookie，前端发送 `X-BOBBUY-CSRF-TOKEN` header，并由 Spring Security 对 cookie-backed refresh/logout 请求强制校验。
- **轮换与并发**：默认每次 refresh 都轮换 refresh token；同一旧 refresh token 在并发场景下只允许一次成功轮换，其余请求返回 401。为避免并发误伤，本轮采用更保守策略：旧 token 重放不再自动撤销整条 family，而是直接拒绝并要求重新使用当前有效会话。
- **前端登录态**：前端只在 localStorage 保存 access token、到期时间和用户信息；refresh token 不再写入 localStorage，降低 XSS 可读暴露面。
- **本地演示账号**：仅在显式开启 `BOBBUY_SEED_ENABLED=true` 时提供 `agent / agent-pass`、`customer / customer-pass`。
- **兼容策略**：`X-BOBBUY-ROLE` / `X-BOBBUY-USER` 仅在显式开启 `bobbuy.security.header-auth.enabled=true` 时可用，默认仅供 dev/test 过渡。
- **生产要求**：公网部署必须配置 `BOBBUY_SECURITY_JWT_SECRET`，且不得开启 `BOBBUY_SECURITY_HEADER_AUTH_ENABLED=true`。
- **WebSocket 鉴权**：前端 STOMP 客户端通过 `Authorization: Bearer <access-token>` 连接 `/ws`，后端在 STOMP `CONNECT`/`SUBSCRIBE` 阶段校验 JWT，并限制 customer 仅能访问本人订单/行程聊天上下文。
- **前端恢复边界**：HTTP API 遇到 access token 过期时最多自动 refresh 并重试一次；并发 401 会合并为同一轮 refresh。WebSocket 鉴权失败时会尝试刷新一次并用新 access token 重连；refresh 失败后停止重连并进入未登录态，不清空本地未发送消息。
- **服务间鉴权现状**：gateway-service 会清理外部伪造的 `X-BOBBUY-SERVICE-TOKEN` / `X-BOBBUY-INTERNAL-SERVICE`，并在配置 `BOBBUY_SECURITY_SERVICE_TOKEN` 后向下游附带可信内部身份；后端仅对 `/internal/**` 路径信任该 token，且 service token 不等同于最终用户 JWT。
- **service token 边界**：service token 只表达内部服务身份，不能调用用户 refresh 流程换取用户 access token，也不能与 `X-BOBBUY-ROLE` 组合推导用户身份。
- **服务壳 smoke test**：可通过 `cd /home/runner/work/bobbuy/bobbuy && mvn -pl bobbuy-core,bobbuy-ai,bobbuy-im,bobbuy-auth,bobbuy-gateway -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest='*SmokeTest,*InternalServiceHeaderFilterTest' test` 验证五个服务壳最小启动与 gateway header 清理。
- **当前安全边界**：暂未实现第三方 OAuth/SSO、mTLS / service mesh、独立 schema / 数据所有权、契约测试、拆分后独立 CI/CD；当前 cookie 方案按 same-origin 试运行部署收口，跨站前后端分离部署仍需后续专门方案；旧库升级仍需按 Flyway 基线/备份流程执行。

## 验收门禁

默认门禁（每个 PR / `main` push 必跑）：
- `cd backend && mvn test`
- `cd frontend && npm ci && npm test`
- `cd frontend && npm run build`

AI / OCR 默认测试边界：
- 默认单测只走 fake/mock/H2，不连接真实 Ollama、Codex Bridge、Codex CLI、OCR service、MinIO。
- 真实 AI/OCR 验收仅在专用环境执行，见 `docs/reports/TEST-MATRIX-本地与CI执行矩阵.md`。
- Sample 字段级黄金值基线：`docs/fixtures/ai-onboarding-sample-golden.json`
- Sample 对比脚本：`pwsh /home/runner/work/bobbuy/bobbuy/scripts/verify-ai-onboarding-samples.ps1`
- Sample 脚本 dry-run fixture：`docs/fixtures/ai-onboarding-sample-scan-mock.json`
- Sample 门禁命令（默认 gate 模式，遇到 `FAIL` / `SCAN_FAIL` / `MISSING_FILE` 返回非零）：
  `pwsh -NoProfile -Command "& '/home/runner/work/bobbuy/bobbuy/scripts/verify-ai-onboarding-samples.ps1' -MockScanResponsePath '/home/runner/work/bobbuy/bobbuy/docs/fixtures/ai-onboarding-sample-scan-mock.json' -SampleIds @('IMG_1484.jpg','IMG_1638.jpg') -IncludeNeedsHumanGolden"`
- Sample report-only 命令（仅人工出报告，不得作为 release gate）：
  `pwsh -NoProfile -Command "& '/home/runner/work/bobbuy/bobbuy/scripts/verify-ai-onboarding-samples.ps1' -MockScanResponsePath '/home/runner/work/bobbuy/bobbuy/docs/fixtures/ai-onboarding-sample-scan-mock-fail.json' -SampleIds @('IMG_1484.jpg') -ReportOnly"`
- 专项报告：`docs/reports/REPORT-03-AI商品字段识别样例验证报告.md`
- 发版候选证据报告：`docs/reports/REPORT-04-发版候选门禁验收报告.md`
- 发版阻断项处置报告：`docs/reports/REPORT-05-发版阻断项处置报告.md`
- 专用环境发版证据与放行判定：`docs/reports/REPORT-06-专用环境发版证据与放行判定.md`
- NO-GO 解阻与放行复判：`docs/reports/REPORT-07-NO-GO阻断项解阻与放行复判.md`
- PLAN-50 AI 放行链路执行报告：`docs/reports/REPORT-09-PLAN50-AI放行链路执行报告.md`
- `cd backend && mvn -DskipTests package && cd /home/runner/work/bobbuy/bobbuy && docker build backend -t bobbuy-backend-test`
- `cd /home/runner/work/bobbuy/bobbuy && docker build frontend -t bobbuy-frontend-test`

专用环境门禁（不进入默认 Hosted CI）：
- `cd backend && mvn -Dflyway.url=jdbc:postgresql://localhost:5432/bobbuy -Dflyway.user=bobbuy -Dflyway.password=bobbuypassword -Dflyway.cleanDisabled=false flyway:clean flyway:migrate flyway:validate`
- `cd /home/runner/work/bobbuy/bobbuy && mvn -pl bobbuy-core,bobbuy-ai,bobbuy-im,bobbuy-auth,bobbuy-gateway -am -Dsurefire.failIfNoSpecifiedTests=false -Dtest='*SmokeTest,*InternalServiceHeaderFilterTest' test`
- `cd frontend && npm run e2e`
- `cd frontend && npm run e2e:ai`
- `workflow_dispatch`: `.github/workflows/ai-release-evidence.yml`（需传专用后端 URL；`frontend` 支持 `BOBBUY_API_PROXY_TARGET` / `BOBBUY_WS_PROXY_TARGET` 与 `BOBBUY_E2E_AGENT_USERNAME` / `BOBBUY_E2E_AGENT_PASSWORD`）

Playwright smoke 口径：
- `npm run e2e` 使用 Vite dev server（`frontend/playwright.config.ts`），不依赖真实 AI/OCR/MinIO/外部服务。
- 默认覆盖 agent / customer 两类浏览器会话，覆盖登录态恢复、客户订单/账单/聊天、agent 采购/拣货/库存、角色门禁与聊天图片发布人工接管 smoke。
- 发布前双角色移动端黑盒走查使用 `npm run e2e --prefix frontend -- e2e/mobile_customer_blackbox.spec.ts` 与 `npm run e2e --prefix frontend -- e2e/mobile_agent_blackbox.spec.ts`，覆盖 `390x844` / `360x800` 下客户和采购者的完整任务路径；mock 通过不替代真实试运行栈复验。
- 浏览器端只保留 access token、本地用户信息与 CSRF cookie；默认 smoke 不再依赖 `bobbuy_test_role` / `bobbuy_test_user` 伪造角色头。
- Playwright 失败时会保留 `playwright-report/`、`test-results/` 下的 HTML 报告、trace、screenshot、video；手动 CI job 会上传这些 artifact。
- `npm run e2e:ai` 继续只跑真实 AI/OCR 专用链路；专用环境执行时默认使用真实登录，不再依赖 mock agent 会话。

风险登记 / 独立安全门禁：
- CodeQL / 安全扫描（`.github/workflows/codeql.yml`：`push` / `pull_request` / `workflow_dispatch`）
- 依赖审计（前端 `npm audit --json`；后端 `.github/workflows/dependency-check.yml` 或本地 Maven 扫描）
- 若本次 PR / Release 未执行，必须明确登记为风险项，不得写成“已通过”。

## 试运行最小运维基线

- 日志：统一使用 `docker compose logs` + `X-Trace-Id` + 应用请求日志排障；关键字段包含 `method/path/status/cost/trace_id/user/role/internal_service`
- 指标：`/api/metrics` 提供轻量 endpoint 请求次数、`p95/p99`、`4xx/5xx`、登录失败次数与全局 `5xx` 比率
- AI / OCR：继续以 trace、`fallbackReason`、`FAILED_RECOGNITION`、`PENDING_MANUAL_REVIEW` 为主，不在本阶段强行引入 Prometheus
- 告警 / 故障处置：统一见 `RUNBOOK-监控告警与故障处置.md`
- 备份恢复：统一见 `RUNBOOK-备份恢复演练.md`；恢复验证必须先在新库 / 独立 bucket / 独立目录完成

最近本地验证：
- `docker compose config`：通过。
- `.\mvnw.cmd -f backend\pom.xml test`：通过（`175 tests, 0 failures, 0 errors, 2 skipped`）。
- `cd frontend && npm ci && npm test && npm run build`：通过。
- `bash scripts/build-service-images.sh`：通过；`Dockerfile.service` 已改为直接复制宿主机构建好的 jar，不再在容器内执行 Maven，脚本会在 Windows/Git Bash/WSL 下自动使用 Maven wrapper。
- `docker compose up -d postgres minio redis rabbitmq nacos nacos-init core-service ai-service im-service auth-service gateway-service frontend gateway ocr-service`：在临时本地 secret 下通过；Nacos cgroup v2、`nacos-init`、OCR 延迟初始化与 gateway health 均已验证。
- `curl http://127.0.0.1/api/health`、`/api/actuator/health`、`/api/actuator/health/readiness`、`http://127.0.0.1:8000/health`：通过。
- `cd frontend && npm run e2e`：通过（`46 passed / 2 skipped`；`2 skipped` 为 `RUN_AI_VISION_E2E` 门控用例）。
- `pwsh -NoProfile -Command "& '/home/runner/work/bobbuy/bobbuy/scripts/verify-ai-onboarding-samples.ps1' -MockScanResponsePath '/home/runner/work/bobbuy/bobbuy/docs/fixtures/ai-onboarding-sample-scan-mock.json' -SampleIds @('IMG_1484.jpg','IMG_1638.jpg') -IncludeNeedsHumanGolden"`：通过（gate 模式返回 `0`）
- `pwsh -NoProfile -Command "& '/home/runner/work/bobbuy/bobbuy/scripts/verify-ai-onboarding-samples.ps1' -MockScanResponsePath '/home/runner/work/bobbuy/bobbuy/docs/fixtures/ai-onboarding-sample-scan-mock-fail.json' -SampleIds @('IMG_1484.jpg')"`：按预期失败（gate 模式返回非零并继续输出报告）
- `pwsh -NoProfile -Command "& '/home/runner/work/bobbuy/bobbuy/scripts/verify-ai-onboarding-samples.ps1' -MockScanResponsePath '/home/runner/work/bobbuy/bobbuy/docs/fixtures/ai-onboarding-sample-scan-mock-fail.json' -SampleIds @('IMG_1484.jpg') -ReportOnly"`：通过（report-only 返回 `0`，但 `gatePassed=false`）
- `cd frontend && npm audit --json`：已降至 `0 critical / 0 high / 6 moderate`；剩余为 Vite/Vitest dev-only 风险，详见 `REPORT-05`
- GitHub Actions 默认 `BOBBuy CI`：`main` 分支 run <https://github.com/sunshaoxuan/bobbuy/actions/runs/25217655067> 通过。
- GitHub Actions `CodeQL` workflow：最新 `main` success run 为 <https://github.com/sunshaoxuan/bobbuy/actions/runs/25217655038>，高危告警清零。
- GitHub Actions `Maven dependency-check` workflow：最新 `main` run <https://github.com/sunshaoxuan/bobbuy/actions/runs/25217516557> 成功，artifact `dependency-check-report`（id `6750657743`）已核验可下载且同时包含 HTML/JSON；摘要为 `0 critical / 0 high / 13 medium / 2 low`。
- `pwsh scripts/verify-ai-onboarding-samples.ps1 ... -AuthToken <agent token>`：PLAN-50 已打到真实 `/api/ai/onboard/scan` 并通过，结果为 `3 PASS / 0 FAIL / 0 SCAN_FAIL`，`gatePassed=true`；证据见 `docs/reports/evidence/ai-onboarding-real-sample-plan50-2026-05-02.*`。
- `cd frontend && RUN_AI_VISION_E2E=1 npm run e2e:ai`：PLAN-50 已在真实 Compose 栈通过，`2 passed`。
- `cd /home/runner/work/bobbuy/bobbuy/backend && mvn -Dflyway.url=jdbc:postgresql://localhost:5432/bobbuy -Dflyway.user=bobbuy -Dflyway.password=bobbuypassword -Dflyway.cleanDisabled=false flyway:clean flyway:migrate flyway:validate`：通过
- PostgreSQL 备份恢复演练：`pg_dump -> bobbuy_restore_verify_plan40` 恢复校验通过
- `cd backend && mvn -DskipTests package`：通过。
- `cd /home/runner/work/bobbuy/bobbuy && docker build backend -t bobbuy-backend-test`：通过。
- `cd /home/runner/work/bobbuy/bobbuy && docker build frontend -t bobbuy-frontend-test`：通过。
- 真实旧库 adoption / restore drill：**仓库内未提供真实旧库副本 / 历史 schema dump，当前仍为 blocker**

详细矩阵见 [docs/reports/TEST-MATRIX-本地与CI执行矩阵.md](docs/reports/TEST-MATRIX-本地与CI执行矩阵.md)。

当前边界执行摘要见 [docs/reports/REPORT-01-试运行服务边界执行报告.md](docs/reports/REPORT-01-试运行服务边界执行报告.md)。
当前发版候选门禁执行摘要见 [docs/reports/REPORT-04-发版候选门禁验收报告.md](docs/reports/REPORT-04-发版候选门禁验收报告.md)。
当前专用环境发版证据与最终放行判定见 [docs/reports/REPORT-06-专用环境发版证据与放行判定.md](docs/reports/REPORT-06-专用环境发版证据与放行判定.md)。
当前 NO-GO 解阻复判见 [docs/reports/REPORT-07-NO-GO阻断项解阻与放行复判.md](docs/reports/REPORT-07-NO-GO阻断项解阻与放行复判.md)。
PLAN-50 AI 放行链路执行摘要见 [docs/reports/REPORT-09-PLAN50-AI放行链路执行报告.md](docs/reports/REPORT-09-PLAN50-AI放行链路执行报告.md)。
