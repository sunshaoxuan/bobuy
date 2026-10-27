# RUNBOOK: BOBBuy 试运行部署

> 2026-10-27 候选更新：图片统一使用 PostgreSQL `bb_recommendation_image`；原对象存储服务已从候选代码与部署依赖移除。生产切换状态和回退步骤以 [PostgreSQL 18 升级与图片存储说明](../reports/POSTGRES18-STORAGE.md) 为准，不能直接把旧数据目录挂给18启动。


**适用范围**: 内部 / 小范围试运行  
**不适用范围**: 高可用生产集群、TLS/域名证书、Secret Manager、监控告警自动化

关联 Runbook：

- 监控告警与故障处置：[`RUNBOOK-监控告警与故障处置.md`](RUNBOOK-监控告警与故障处置.md)
- 备份恢复演练：[`RUNBOOK-备份恢复演练.md`](RUNBOOK-备份恢复演练.md)

---

## 1. 配置优先级

部署配置按以下优先级生效：

1. 容器环境变量（`docker compose` / `.env`）
2. Nacos 配置（`infra/nacos/config/*.yaml`）
3. `application-{profile}.properties`
4. `application.properties`

约束：

- 共享 / 服务器部署必须显式设置 `SPRING_PROFILES_ACTIVE=prod`（Compose 已内置）。
- `BOBBUY_SECURITY_JWT_SECRET` 必须在 `.env` 中显式填写。
- `BOBBUY_SECURITY_HEADER_AUTH_ENABLED` 默认且必须保持为 `false`。
- `BOBBUY_SECURITY_JWT_TTL_SECONDS` 控制 HTTP 与 WebSocket 共用的 access token 生命周期。
- `BOBBUY_SECURITY_REFRESH_TOKEN_TTL_SECONDS` 控制 refresh token 生命周期，默认 604800 秒（7 天）。
- `BOBBUY_SECURITY_REFRESH_TOKEN_ROTATION_ENABLED` 默认 `true`；在当前服务端 hash-only refresh token 方案下建议保持开启。
- refresh cookie 默认使用 `BOBBUY_SECURITY_REFRESH_COOKIE_NAME=bobbuy_refresh_token`、`BOBBUY_SECURITY_REFRESH_COOKIE_PATH=/api/auth`、`BOBBUY_SECURITY_REFRESH_COOKIE_SAME_SITE=Lax`；公网 HTTPS 部署必须把 `BOBBUY_SECURITY_REFRESH_COOKIE_SECURE=true`。
- CSRF double-submit token 默认使用 `BOBBUY_SECURITY_CSRF_COOKIE_NAME=bobbuy_csrf_token`、`BOBBUY_SECURITY_CSRF_COOKIE_PATH=/`、`BOBBUY_SECURITY_CSRF_HEADER_NAME=X-BOBBUY-CSRF-TOKEN`。
- Compose 仅允许 `core-service` 执行 Flyway migration，其余服务固定 `SPRING_FLYWAY_ENABLED=false`。

## 1.1 试运行服务边界

- **主业务入口**：`backend`（源码、测试、Flyway migration 目录）
- **事实源**：`core-service`（试运行部署中的核心业务事实源与 Flyway 执行者）
- **服务外壳**：`ai-service`、`im-service`、`auth-service`
- **可选服务**：`ocr-service` 为 AI/OCR 增强能力依赖，不是核心业务事实源
- **后续拆分候选**：`ai-service`、`im-service`、`auth-service`

当前约束：

1. `ai-service`、`im-service`、`auth-service` 继续复用 `backend` 共享代码、共享 PostgreSQL schema 与共享安全配置。
2. 这些服务当前不是独立事实源，不得在试运行中宣称已经完成独立业务拆分。
3. 当前默认 Compose 仍保留这些服务外壳，因为网关路由与回归测试尚未准备好安全降级为 optional/profile。

---

## 2. 环境准备

最低准备项：

- Docker Engine + Docker Compose Plugin
- 至少一台可运行全部容器的 Linux 主机
- 计划使用的 AI provider：
  - **推荐**：Ollama / 私有兼容 gateway
  - **可选**：OpenAI-compatible `codex-bridge`，用于受控个人 Codex 订阅桥接服务
  - **可选**：受控桌面环境中的 Codex CLI
  - **禁止作为服务器默认方案**：依赖个人 Windows 桌面 Codex CLI 登录态

数据库版本策略：

- 试运行 Compose 固定使用 `postgres:18.6-alpine3.23`。
- 原因：避免继续承受 PostgreSQL 18 与 Flyway 10.15.2 的“高于已验证范围”提示风险。
- 如后续要升级 PostgreSQL 大版本，需先单独验证 Flyway 兼容性并更新本文档。
- 若旧环境已有 `./data/postgres_v18` 数据目录，切换到当前 Compose 前必须先停服务并把数据迁移 / 备份到 `./data/postgres18`，不要在未迁移数据目录的情况下直接覆盖启动。
- 当前内部试运行确认无历史业务数据，旧库 adoption / restore drill 不适用；上线按空库 Flyway 初始化、可选 seed、真实栈黑盒与备份恢复演练执行。若未来导入历史数据，必须重新启用旧库 adoption 门禁。

---

## 3. 生成 `.env`

1. 复制模板：
   ```bash
   cd /home/runner/work/bobbuy/bobbuy
   cp .env.template .env
   ```
2. 至少修改以下项目后再部署：
     - `BOBBUY_SECURITY_JWT_SECRET`
     - `BOBBUY_SECURITY_REFRESH_TOKEN_TTL_SECONDS`
     - `BOBBUY_SECURITY_REFRESH_COOKIE_SECURE`
     - `BOBBUY_SECURITY_SERVICE_TOKEN`
    - `POSTGRES_PASSWORD`
    - `RABBITMQ_DEFAULT_PASS`
    - 可用 `openssl rand -base64 32` 生成 `BOBBUY_SECURITY_JWT_SECRET`
    - 可用第二次 `openssl rand -base64 32` 生成 `BOBBUY_SECURITY_SERVICE_TOKEN`
    - 若 `BOBBUY_SECURITY_JWT_SECRET` 为空，后端会在启动阶段直接失败，不会以空 secret 进入试运行
3. 按实际环境选择 AI 路径：
   - **Ollama / 私有兼容 gateway**：填写 `BOBBUY_AI_LLM_MAIN_URL`
   - **Codex Bridge**：填写 `BOBBUY_AI_LLM_MAIN_PROVIDER=codex-bridge`、`BOBBUY_AI_LLM_CODEX_BRIDGE_URL`；明文 key 只放 `.env` / secret manager，或用 `scripts/encrypt-ai-secret.ps1` 生成 `BOBBUY_AI_LLM_CODEX_BRIDGE_SECRET_*` 密文字段并把 `BOBBUY_AI_SECRET_MASTER_PASSWORD` 留在宿主机环境变量
   - **视觉 / edge 模型**：填写 `BOBBUY_AI_LLM_EDGE_URL`；只有 edge 节点模型名与默认 `llama3.2-vision:11b` 不一致时才覆盖 `BOBBUY_AI_LLM_EDGE_MODEL`
   - **OCR 容器同编排部署**：保持 `BOBBUY_OCR_URL=http://ocr-service:8000`
   - **本地桌面 Codex CLI 兜底**：仅在受控本机设置 `BOBBUY_AI_LLM_CODEX_COMMAND=codex`
4. 仅限本地调试可保留的默认项：
   - `POSTGRES_PASSWORD=bobbuypassword`
   - `RABBITMQ_DEFAULT_PASS=bobbuypassword`
    - `BOBBUY_BIND_HOST=127.0.0.1`
5. WebSocket / 聊天鉴权约束：
    - 浏览器端只在 localStorage 保存 access token、用户信息和到期时间；refresh token 不再保存到 localStorage。
    - `POST /api/auth/refresh`、`POST /api/auth/logout` 依赖 `bobbuy_refresh_token` HttpOnly cookie，并要求前端附带 `X-BOBBUY-CSRF-TOKEN`。
    - 当前 same-origin 试运行默认 `SameSite=Lax`；若计划跨站前后端分离部署，需先单独评估 cookie / CORS / CSRF 新方案。
    - 前端只通过 STOMP `CONNECT` header `Authorization: Bearer <access-token>` 连接 `/ws`
    - 不使用 query token，避免 access token 出现在 URL / 访问日志
    - access token 失效后前端 HTTP 层会自动 refresh 并重试一次；refresh 失败后会清理本地登录态
    - WebSocket 鉴权失败时前端会尝试 refresh 一次并用新 access token 重连；refresh 失败后停止重连并需重新登录
6. 服务间鉴权约束：
   - gateway-service 会清理外部伪造的 `X-BOBBUY-SERVICE-TOKEN` / `X-BOBBUY-INTERNAL-SERVICE`，并在配置 `BOBBUY_SECURITY_SERVICE_TOKEN` 后向下游附带可信内部身份
   - 后端仅对 `/internal/**` 信任 service token；普通业务接口仍需用户 JWT 或显式允许的匿名访问
   - service token 只表达内部服务身份，不等同于最终用户身份；如需用户上下文，仍必须携带并校验用户 JWT
   - mTLS / service mesh 仍未实现；在补齐前不得继续真实微服务深拆或暴露服务壳直连公网

---

## 4. 首次启动

首次启动前先校验配置：

```bash
cd /home/runner/work/bobbuy/bobbuy
    docker compose config
    ```

推荐先构建服务壳 jar 与镜像：

```bash
bash scripts/build-service-images.sh
docker compose build core-service ai-service im-service auth-service gateway-service
```

空库试运行验收如需 demo 数据，可显式设置：

```bash
BOBBUY_SEED_ENABLED=true
BOBBUY_SEED_PICKING_FIXTURE_ENABLED=true
```

该 seed 仅用于本地/试运行验收。`BOBBUY_SEED_ENABLED=true` 生成客户、采购者、行程与基础订单；`BOBBUY_SEED_PICKING_FIXTURE_ENABLED=true` 额外生成已确认订单、已复核小票与拣货 checklist 所需数据。生产共享环境默认仍应保持两个开关均为 `false`。

构建服务壳镜像：

```bash
cd /home/runner/work/bobbuy/bobbuy
bash scripts/build-service-images.sh
```

`Dockerfile.service` 只复制宿主机预构建 jar；不要直接在干净工作区跳过 jar 构建后执行 `docker compose build core-service ...`。该脚本会先构建 `bobbuy-core`、`bobbuy-ai`、`bobbuy-im`、`bobbuy-auth`、`bobbuy-gateway`，再构建对应 Compose 镜像。

首次启动：

```bash
cd /home/runner/work/bobbuy/bobbuy
docker compose up -d postgres redis rabbitmq nacos nacos-init core-service ai-service im-service auth-service gateway-service frontend gateway ocr-service
```

观察关键服务：

```bash
docker compose ps
docker compose logs -f core-service ai-service gateway-service
```

鉴权 / 服务壳 smoke：

```bash
curl -i http://127.0.0.1:${GATEWAY_HOST_PORT:-80}/api/auth/me
# 预期 401

cd /home/runner/work/bobbuy/bobbuy
mvn -pl bobbuy-core,bobbuy-ai,bobbuy-im,bobbuy-auth,bobbuy-gateway -am \
  -Dsurefire.failIfNoSpecifiedTests=false \
  -Dtest='*SmokeTest,*InternalServiceHeaderFilterTest' test
# 预期通过：5 个服务壳最小启动 + gateway 内部 header 清理
```

Playwright 试运行 smoke：

```bash
cd /home/runner/work/bobbuy/bobbuy/frontend
npm ci
npm run e2e
```

- 当前 `npm run e2e` 使用 Vite dev server + Playwright mock 浏览器会话，验证 agent/customer 登录态恢复、客户订单/账单/聊天、采购/拣货/库存人工接管与角色门禁。
- 失败时查看 `frontend/playwright-report/index.html`，以及 `frontend/test-results/**/trace.zip`、`test-failed-1.png`、`video.webm`。
- GitHub Actions 手动 `playwright-e2e` job 会上传同名 artifact；试运行放行前必须至少人工通过一次。
- `npm run e2e:ai` 仍需 `RUN_AI_VISION_E2E=1` 与真实 AI/OCR 专用环境，不属于默认 smoke。

发版候选专用环境验收：

1. 前置条件
   - 后端 `/api/ai/onboard/scan` 可达
   - 真实 OCR provider 可用
   - 真实 LLM provider 可用
   - seed 数据包含商品、类目、供应商规则
   - `sample/` 样本图片目录可访问
2. 执行顺序
   ```bash
    pwsh /home/runner/work/bobbuy/bobbuy/scripts/verify-ai-onboarding-samples.ps1 -IncludeNeedsHumanGolden

    cd /home/runner/work/bobbuy/bobbuy/frontend
    RUN_AI_VISION_E2E=1 npm run e2e:ai
    ```
   - 默认 `verify-ai-onboarding-samples.ps1` 为 gate 模式：只要存在 `FAIL` / `SCAN_FAIL` / `MISSING_FILE` 就返回非零。
   - 若只需人工导出报告，可额外使用 `-ReportOnly`，但**不得**把 report-only 命令当作 release gate 通过证据。
3. 产物要求
   - sample JSON report：`/tmp/ai-onboarding-sample-report.json`
   - sample Markdown report：`/tmp/ai-onboarding-sample-report.md`
   - Playwright `frontend/playwright-report/`
   - Playwright `frontend/test-results/`
4. 注意
    - `docs/fixtures/ai-onboarding-sample-scan-mock.json` 只用于脚本 dry-run 自检，不得替代真实专用环境放行证据
    - `docs/fixtures/ai-onboarding-sample-scan-mock-fail.json` 只用于验证 gate/report-only 语义，不代表真实识别结论
    - `needsHumanGolden=true` 的样例必须列出人工复核项，不得静默写成通过

Flyway 验证点：

- 仅 `core-service` 日志应出现 migration 执行。
- `ai-service` / `im-service` / `auth-service` 不应并发执行 Flyway。
- 如是旧库首次纳管，只有在确认 schema 与基线一致且已完成备份后，才允许临时设置 `BOBBUY_FLYWAY_BASELINE_ON_MIGRATE=true`。

Flyway 旧库 adoption / 回滚演练：

1. 先做逻辑备份：
   ```bash
   cd /home/runner/work/bobbuy/bobbuy
   docker compose exec -T postgres pg_dump \
     -U "${POSTGRES_USER:-bobbuy}" \
     -d "${POSTGRES_DB:-bobbuy}" \
     --clean --if-exists --no-owner --no-privileges \
     > /tmp/bobbuy-backup/bobbuy-before-adoption.sql
   ```
2. 检查旧库是否已经存在 `flyway_schema_history`；若不存在，只能在确认 schema 与 `V1__baseline_schema.sql` 对齐后，执行一次性：
   ```bash
   cd /home/runner/work/bobbuy/bobbuy/backend
   mvn -Dflyway.url=jdbc:postgresql://localhost:5432/bobbuy \
     -Dflyway.user=bobbuy \
     -Dflyway.password=bobbuypassword \
     -Dflyway.baselineOnMigrate=true \
     flyway:migrate flyway:validate
   ```
3. 若验证失败或基线判断错误，按 `RUNBOOK-备份恢复演练.md` 恢复到独立验证库，确认无误后再决定是否回灌正式库。
4. 没有真实旧库副本时，不得把 baseline-on-migrate 写成“已演练通过”；必须在发版记录中登记阻塞。

---

## 5. 健康检查与入口

默认仅绑定到宿主机 `127.0.0.1`：

- 网关入口: `http://127.0.0.1:${GATEWAY_HOST_PORT:-80}`
- API 健康检查: `http://127.0.0.1:${GATEWAY_HOST_PORT:-80}/api/health`
- Gateway actuator: `http://127.0.0.1:${GATEWAY_HOST_PORT:-80}/api/actuator/health`
- Gateway readiness: `http://127.0.0.1:${GATEWAY_HOST_PORT:-80}/api/actuator/health/readiness`
- Nacos Console: `http://127.0.0.1:${NACOS_HOST_PORT:-8848}/nacos`
- OCR Service: `http://127.0.0.1:${OCR_HOST_PORT:-8000}`

2026-05-01 本地证据：在临时本地 secret 下，`postgres`、`minio`、`redis`、`rabbitmq`、`nacos`、`core-service`、`ai-service`、`im-service`、`auth-service`、`gateway-service` 均可进入 healthy；`gateway` 与 `frontend` running；`ocr-service` `/health` 返回 `{"status":"ok"}`。生产/试运行环境仍必须用 secret manager 或 `.env` 注入真实 `BOBBUY_SECURITY_JWT_SECRET` / `BOBBUY_SECURITY_SERVICE_TOKEN`，不得把临时测试 secret 写入 git。

容器内健康检查重点：

- `postgres`: `pg_isready`
- `minio`: `/minio/health/live`
- `nacos`: `/nacos/v1/console/health/readiness`
- `core-service` / `ai-service` / `im-service` / `auth-service` / `gateway-service`: `/actuator/health/readiness`

角色说明：

- `core-service`：核心业务事实源与 Flyway 执行者
- `auth-service`：登录 / JWT 服务外壳
- `ai-service`：AI/OCR 服务外壳
- `im-service`：聊天 / WebSocket 服务外壳
- `gateway-service`：路由层，不写业务库
- `gateway-service` 同时负责向下游附带最小内部 service token；nginx 入口会先清空外部伪造的内部 header

---

## 6. 登录账号策略

- 试运行 / 服务器部署默认 `BOBBUY_SEED_ENABLED=false`。
- 不要把 demo seed credentials 当作共享环境长期账号。
- 如仅做本地演示并显式开启 seed，可使用：
  - `agent / agent-pass`
  - `customer / customer-pass`
- 共享环境应由受控初始化流程创建真实试运行账号。

---

## 7. AI provider 选择策略

推荐顺序：

1. **Ollama / 私有兼容 gateway**
   - 适用于服务器、容器、受控内网
   - 通过 `BOBBUY_AI_LLM_MAIN_URL` / `BOBBUY_AI_LLM_EDGE_URL` 指定
2. **Codex Bridge**
   - 适用于个人受控、OpenAI-compatible `/v1/chat/completions` 桥接服务
   - 通过 `BOBBUY_AI_LLM_CODEX_BRIDGE_URL`、`BOBBUY_AI_LLM_CODEX_BRIDGE_MODEL` 指定
   - key 可直接由环境变量 `BOBBUY_AI_LLM_CODEX_BRIDGE_API_KEY` 注入；如提交密文字段，必须把 `BOBBUY_AI_SECRET_MASTER_PASSWORD` 放在 git 外部
3. **Codex CLI 本地兜底**
   - 仅适用于本地桌面、受控登录态
   - 不能作为 Linux 服务器容器默认前提

运行时口径：

- `LlmGateway` 启动日志会输出 configured provider、active provider、Ollama URL、Codex Bridge URL、Codex command；不会输出 API key。
- 当 `BOBBUY_AI_LLM_MAIN_URL`、`BOBBUY_AI_LLM_CODEX_BRIDGE_URL` 与 `BOBBUY_AI_LLM_CODEX_COMMAND` 都为空时，active provider 会显示为 `unconfigured`，AI 功能按现有 fallback/人工流程降级。
- AI / OCR 不可用时，系统允许回落到现有 fallback 路径；本任务不把 AI 不可用写成“已恢复”。
- AI 商品上架与小票识别响应都会附带 trace 字段（provider / activeProvider / model / stage / latencyMs / errorCode / fallbackReason / retryCount / attemptNo / inputRef / outputRef）。

---

## 8. 日志与排障

常用命令：

```bash
cd /home/runner/work/bobbuy/bobbuy
docker compose logs -f core-service
docker compose logs -f ai-service
docker compose logs -f gateway-service
docker compose logs -f nacos
```

最小日志字段口径：

- HTTP：`method/path/status/cost/trace_id/user/role/internal_service`
- AI / OCR：`provider/activeProvider/model/stage/latencyMs/errorCode/fallbackReason`
- 排障优先级：先看 `gateway` / `gateway-service`，再看对应业务服务与基础设施

重点排查项：

1. **登录失败 / 401**
     - 确认 `BOBBUY_SECURITY_JWT_SECRET` 非空
     - 确认 `BOBBUY_SECURITY_REFRESH_TOKEN_TTL_SECONDS` 与客户端时间未出现异常漂移
     - 确认 `BOBBUY_SECURITY_REFRESH_COOKIE_SECURE`、`BOBBUY_SECURITY_REFRESH_COOKIE_SAME_SITE` 与当前访问方式一致（HTTP 本地调试不要误配 `Secure=true`）
     - 确认浏览器仍持有 `bobbuy_refresh_token` / `bobbuy_csrf_token`，且 refresh/logout 请求已附带 `X-BOBBUY-CSRF-TOKEN`
     - 确认 `BOBBUY_SECURITY_HEADER_AUTH_ENABLED=false`
     - 若只表现为聊天实时消息失效，补查 refresh 是否成功、WebSocket 是否已携带新 access token 重连
  1.1 **内部接口 401**
     - 确认 `BOBBUY_SECURITY_SERVICE_TOKEN` 已在 `.env`、Compose 与 Nacos 渲染生效
     - 确认请求没有直接伪造 `X-BOBBUY-SERVICE-TOKEN` / `X-BOBBUY-INTERNAL-SERVICE`
     - `/internal/**` 只接受可信 service token，不接受浏览器直连
2. **服务起不来**
   - 先看 `docker compose ps`
   - 再看对应服务 readiness 日志
3. **Flyway 报错**
   - 确认只有 `core-service` 启用了 Flyway
   - 旧库先备份，再评估是否允许 `baseline-on-migrate`
4. **AI 无响应**
    - 检查 `BOBBUY_AI_LLM_MAIN_URL` / `BOBBUY_AI_LLM_CODEX_BRIDGE_URL` / `BOBBUY_AI_LLM_EDGE_URL`
    - 使用 Codex Bridge 时确认 `/v1/models` 返回授权后的模型列表，且 key 或密文字段能被当前环境解密
    - 服务器不要默认依赖 Codex CLI
    - 确认 `ai-service` 作为服务外壳已启动，且不要把它误判为独立业务事实源
    - 前端若出现 `unconfigured` / `FAILED_RECOGNITION` / `PENDING_MANUAL_REVIEW`，按页面提示走重试或人工补录/复核
5. **PostgreSQL 图片表 上传失败**
6. **边界误判**
    - 若发现文档、Runbook 或排障流程把 `ai-service` / `im-service` / `auth-service` 写成“独立微服务事实源”，应以 `ADR-01` 与当前 Runbook 为准进行修正
7. **WebSocket 鉴权失败**
     - 前端若能打开聊天但实时消息不更新，先确认 access token 是否已刷新、refresh token 是否仍有效
     - 检查 `im-service` / `core-service` 日志中是否出现 websocket auth / chat forbidden
     - 不要通过 query token 或重新开启 header auth 绕过问题

人工处理流程：
1. 商品 AI 上架失败时，前端会显示失败原因并允许人工补录后保存草稿；默认保持 `DRAFTER_ONLY`。
2. 小票识别 fallback 或失败时，前端显示 fallback / review 状态、trace 摘要，并保留重新识别入口。
3. 仅 `REVIEWED` 小票会进入 `/procurement` 与 `/picking` 的已复核事实链；未确认识别结果不会自动改账。

更多告警阈值、故障清单与升级条件见 [`RUNBOOK-监控告警与故障处置.md`](RUNBOOK-监控告警与故障处置.md)。

---

## 9. 回滚步骤

回滚前提：先确认最近一次可用镜像 / 代码版本、数据库备份、PostgreSQL 图片表 备份、Nacos 配置快照。

建议顺序：

1. `docker compose down`
2. 恢复 `.env` 到上一个已验证版本
3. 恢复 PostgreSQL 备份
4. 恢复 PostgreSQL 图片表 对象与 Nacos 配置
5. 重新启动：
   ```bash
   docker compose up -d --build
   ```
6. 重新执行健康检查

注意：

- 不要在未恢复数据库/对象存储备份的情况下只回滚应用镜像。
- 不要把未验证的 Compose 全量启动写成“已回滚成功”。

---

## 10. 备份提醒

部署前和升级前至少备份：

- PostgreSQL 数据库
- PostgreSQL 图片表 bucket 数据
- Nacos `infra/nacos/config/*.yaml` 对应配置快照
- 当前 `.env`

当前仍未完成的运维边界：

- 高可用 / 多副本
- TLS / 域名证书
- Secret Manager
- 真实监控 / 告警平台
- 自动化备份恢复演练
- mTLS / service mesh / 契约测试
- OAuth / SSO
- 跨站前后端分离部署下的更通用 cookie / CORS / CSRF 方案

备份与恢复演练命令、恢复验收与记录模板见 [`RUNBOOK-备份恢复演练.md`](RUNBOOK-备份恢复演练.md)。
