# 生产环境持续部署

`.github/workflows/cd-production.yml` 在非纯文档变更推送到 `main` 后运行，也可通过
`workflow_dispatch` 手动运行。`docs/**` 和 Markdown 是唯一改动时不会自动部署；部署按
`production-deployment` 并发组排队，进行中的发布不会被取消。工作流只允许上游仓库运行，
fork 不会部署。`CI_RUNNER` 仓库变量可覆盖默认的 `ubuntu-latest` runner。

## GitHub 配置

在 GitHub Environment `production` 中配置以下 Secrets（只配置真实值，不提交到仓库）：

| Secret | 用途 |
| --- | --- |
| `PROD_SSH_HOST` | 生产 SSH 主机 |
| `PROD_SSH_USER` | 发布专用 SSH 用户 |
| `PROD_SSH_PORT` | SSH 端口 |
| `PROD_SSH_KEY` | 无口令、发布专用的 ed25519 私钥 |
| `PROD_SSH_KNOWN_HOSTS` | 由管理员可信渠道取得的生产主机 `known_hosts` 条目 |

任一项缺失时，工作流会在连接前失败。部署会把 `PROD_SSH_KNOWN_HOSTS` 原样写入
`~/.ssh/known_hosts`，并强制 `StrictHostKeyChecking=yes`；不会运行 `ssh-keyscan`，也不会
关闭主机密钥校验。主机密钥轮换时，应先由管理员通过独立可信渠道验证新指纹，再更新此
Secret。

Environment 默认无需审批即可尽快发布。若要启用手动批准，在仓库 **Settings → Environments
→ production → Deployment protection rules** 中添加 required reviewers。

镜像发布到公开的 GHCR package，并同时使用提交 SHA 和 `latest` 标签。首次创建 package 后，
仓库管理员应在 package 设置中确认可见性为 **Public**。

## 服务器行为与回滚

工作流在 `/opt/bobuy` 复用现有 Compose 文件，只写入 `.compose.cd.yml` 镜像覆盖文件。
`/opt/bobuy/.env` 必须预先存在，发布只将其作为 Compose 输入，绝不创建、覆盖、改写或删除。
这与 #84 的密钥管理约定一致。

发布依次拉取 SHA 镜像、运行 `docker compose up -d`，然后检查网关 Actuator readiness 和前端
HTTP 响应。成功后 `.deploy-revision` 记录 SHA 与 UTC 时间。失败时自动切回其中记录的上一次
成功 SHA、再次检查健康，并保持本次 workflow 失败；首次部署没有上一 SHA 时会明确失败，
不会猜测目标。

手动回滚时，从 `.deploy-revision` 或 Actions 的成功发布记录确定经过验证的 SHA，将
`.compose.cd.yml` 中六个镜像标签全部改成该 SHA，然后在 `/opt/bobuy` 执行：

```sh
docker compose --env-file .env -f docker-compose.yml -f compose.production.yml -f .compose.cd.yml pull
docker compose --env-file .env -f docker-compose.yml -f compose.production.yml -f .compose.cd.yml up -d
```

健康确认后，将实际 SHA 和 UTC 时间写回 `.deploy-revision`。不要修改 `.env`。

## 数据库迁移风险

Java 服务使用 Flyway 自动迁移。应用镜像回滚不保证数据库变更也能回滚。发布包含迁移时，
应先按生产备份恢复 runbook 验证可用备份和恢复路径，并审查迁移的前后兼容性；故障后不要在
已有新写入时直接以旧数据库快照覆盖生产，应先隔离写入并制定前向修复或兼容应用回滚方案。
