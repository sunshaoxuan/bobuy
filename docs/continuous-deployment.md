# 生产环境持续部署

`.github/workflows/cd-production.yml` 在应用变更推送到 `main` 后运行，也可通过
`workflow_dispatch` 手动运行。仅改动 `docs/**`、`**/*.md`、`infra/nginx/**`、
`infra/nacos/config/**`、`docker-compose*.yml/yaml` 或 `compose*.yml/yaml`（含子目录）
时不会自动部署；部署按
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

任一项缺失时，工作流会在连接前失败。部署通过 `mktemp -d` 在 `RUNNER_TEMP` 下创建
job 专属目录，目录权限为 700，私钥和 `known_hosts` 文件权限为 600。
SSH 显式传入 `-i`、`UserKnownHostsFile`、`IdentitiesOnly=yes` 和 `BatchMode=yes`，
并强制 `StrictHostKeyChecking=yes`；`if: always()` 步骤清理该目录，不改动 `~/.ssh`。
不会运行 `ssh-keyscan`，也不会
关闭主机密钥校验。主机密钥轮换时，应先由管理员通过独立可信渠道验证新指纹，再更新此
Secret。

Environment 默认无需审批即可尽快发布。若要启用手动批准，在仓库 **Settings → Environments
→ production → Deployment protection rules** 中添加 required reviewers。

镜像发布到 GHCR，并同时使用提交 SHA 和 `latest` 标签；部署使用 SHA 标签。
支持私有 package，package 必须允许本仓库 Actions 访问。构建 job 使用 `packages: write`，
部署 job 使用 `packages: read`。部署将当前 job 的 `GITHUB_TOKEN` 通过 SSH stdin
交给远端 `docker login ghcr.io --password-stdin`，凭据仅供拉取镜像使用。
token 不进入远端命令参数或日志。远端使用 `.cd/` 下独立临时 `DOCKER_CONFIG`，
拉取结束立即 logout，退出时清理临时凭据目录，不改动发布用户原有 Docker 登录配置。

## 服务器行为与回滚

`/opt/bobuy` 是现有部署目录，没有 Git checkout。SSH 用户需要 Bash 兼容的登录 shell、
Bash、Docker Compose、curl，以及访问 Docker 和写入 `/opt/bobuy/.cd/` 的权限。
工作流创建 `.cd/` 保存镜像覆盖和恢复状态。Compose 始终使用
`--env-file /etc/bobuy.env -p bobuy -f docker-compose.yml -f compose.production.yml`，
存在 `compose.rustfs.yml` 时追加该文件，最后追加 `-f .cd/compose.yml`。
`/etc/bobuy.env` 缺失即拒绝部署；本工作流绝不创建、覆盖、改写或删除它。
生产目录没有 `.env`，此工作流不依赖该路径。

发布前逐个执行 `docker inspect --format '{{.Image}}'`，从
`bobuy-core-service`、`bobuy-ai-service`、`bobuy-im-service`、`bobuy-auth-service`、
`bobuy-gateway-service` 和 `bobuy-frontend` 捕获镜像 ID，通过 `docker tag` 为每个 ID
创建唯一的本地引用 `bobuy-rollback/<service>:<UTC timestamp>-<short id>`。
校验引用并确认本地镜像存在，后续拉取发布标签不会改变这些回滚引用，
完整写入 `.cd/rollback.yml` 后才开始切换。因此首次 CD 可以恢复现有的
`bobuy/core:20261113.offer-source-drawer.1` 等本地构建镜像，无需 `.deploy-revision`。
每次发布更新这份切换前快照，恢复期间不要删除或重新标记这些本地镜像。

`pull` 和 `up` 均显式限定六个应用服务：`core-service ai-service im-service auth-service
gateway-service frontend`。`up` 使用 `--no-deps --no-build --pull never`，保留
postgres、redis、rabbitmq、nacos、rustfs 及 edge nginx 容器。等待 Java 服务健康，
前端健康或运行后，按 `scripts/publish-production.py` 的顺序执行：

```sh
docker exec bobuy-gateway nginx -t && docker exec bobuy-gateway nginx -s reload
```

这使 nginx 的静态 upstream 重新解析新应用容器的地址。随后用
`curl -fsS --resolve bobuy.cc:443:127.0.0.1` 检查 `https://bobuy.cc/` 和
`https://bobuy.cc/health`，校验证书且必须返回 HTTP 200；不跟随重定向，301 不算成功。
`infra/nginx/bobuy.conf` 将 `/health` 转发至 `gateway-service:8080/api/health`。
容器和 HTTPS 检查各最多尝试 30 次，间隔 10 秒，每个 HTTPS 请求最多 15 秒。

Compose 配置校验、登录、拉取、重建、健康检查或 nginx 校验/重载失败均进入回滚分支。
回滚将 `.cd/rollback.yml` 复制为 `.cd/compose.yml`，使用本地捕获镜像和
`up -d --no-deps --no-build --pull never --force-recreate` 重建六个应用，
随后重复容器健康、nginx 校验/重载和 HTTPS 检查。回滚不依赖 GHCR 可用性。
回滚成功记录 `.cd/last-rollback`；回滚失败明确报错，两者都保持 workflow 失败。
环境文件缺失或无法完整捕获镜像时，在应用切换前退出。
成功发布才写 `.cd/deploy-revision`，内容为 SHA 和 UTC 时间；恢复目标始终来自运行镜像快照。
SSH 断线或主机故障导致进程中断时，需要依据 `.cd/rollback.yml` 和实际容器状态人工恢复。

## 配置发布边界

CD 只部署应用镜像，不同步 nginx、Nacos 配置或 Compose 文件。配置变更需经
`scripts/publish-production.py` 现有手动发布流程处理；混合代码与配置提交触发 CD 时，
仍只替换镜像，必须协调手动发布顺序。`workflow_dispatch` 同样不会传送配置文件。
手动发布或恢复必须核对 `.cd/compose.yml` 与当前运行镜像，后续 Compose 操作应使用一致的
文件集合，防止基础 `compose.production.yml` 的本地标签覆盖已启用的 GHCR 镜像。
本次工作流修订没有执行发布，也没有修改现有手动工具的环境文件管理行为。

## 数据库迁移风险

Java 服务使用 Flyway 自动迁移。应用镜像回滚不保证数据库变更也能回滚。发布包含迁移时，
应先按生产备份恢复 runbook 验证可用备份和恢复路径，并审查迁移的前后兼容性；故障后不要在
已有新写入时直接以旧数据库快照覆盖生产，应先隔离写入并制定前向修复或兼容应用回滚方案。
