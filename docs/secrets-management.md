# 本地敏感配置管理（SOPS + age）

## 本地工具链范围

本次仅停止跟踪根目录 `.env`、两个本地 Spring properties 文件和三个
`backend/startup*.log`，并增加 SOPS + age 的本地加密/解密工具链。生产服务器
`/opt/bobuy/.env` 与部署脚本均不修改。

最小验收包括：确认目标明文及启动日志不在 HEAD、示例文件只保留变量名、四个
脚本的静态语法通过，以及占位公钥会阻止误加密。维护者填入真实公钥并持有私钥后，
还需执行本文的往返校验；仓库不能代替维护者生成或保存私钥。

## 首次准备

1. 安装 [`sops`](https://github.com/getsops/sops) 与
   [`age`](https://github.com/FiloSottile/age)。macOS 可执行
   `brew install sops age`；Windows 可用 `winget install Mozilla.SOPS` 与
   `winget install FiloSottile.age`；Linux 请使用发行版软件包或项目官方发行包。
2. 在维护者本机执行 `age-keygen -o keys.txt`。不要提交 `keys.txt`，也不要把私钥
   写入终端日志、PR、提交信息或评论。
3. 把 `keys.txt` 放在默认位置：macOS/Linux 为
   `~/.config/sops/age/keys.txt`，Windows 为
   `%APPDATA%\sops\age\keys.txt`。使用其他位置时设置 `SOPS_AGE_KEY_FILE`。
4. 将 `.sops.yaml` 中的 `age1REPLACE_ME` 替换为 `age-keygen -y keys.txt` 输出的
   **公钥**。占位符存在时，加密脚本会直接失败，避免产生不可恢复的密文。

## 生成并提交密文

先从有权限的安全副本恢复三个明文文件到其原路径；不要从聊天、Issue 或提交历史
复制或展示其内容。然后执行：

```bash
./scripts/secrets-encrypt.sh
```

或在 Windows PowerShell 中执行：

```powershell
.\scripts\secrets-encrypt.ps1
```

脚本原子生成 `.env.enc`、
`backend/src/main/resources/application-dev.properties.enc` 和
`backend/src/main/resources/application-ai-hermes.properties.enc`。仅提交这些密文；
明文路径已被 `.gitignore` 排除。每次有意修改本地明文后重新执行加密脚本。

## 解密并本地运行

确认私钥文件只对当前用户可读，然后执行：

```bash
./scripts/secrets-decrypt.sh
docker compose config --quiet
docker compose up -d --build
```

Windows PowerShell 对应命令为：

```powershell
.\scripts\secrets-decrypt.ps1
docker compose config --quiet
docker compose up -d --build
```

解密脚本在原路径原子写入明文，不会把内容输出到控制台。若任一密文缺失、工具未
安装或私钥不可用，脚本会失败且不会替换已有文件。没有匹配私钥时，提交的密文无法
解密。本流程不触碰生产服务器 `/opt/bobuy/.env`，现有部署流程保持不变。

## 维护者提交密文前的往返校验

在安全工作区保存明文文件的校验值（不要粘贴到 PR），运行加密脚本，临时移走明文，
再运行解密脚本并在本机比较校验值。三份文件必须逐字节一致。确认后安全删除临时副本
和校验值文件；只暂存 `*.enc` 与本工具链的非敏感变更。

## 生产环境：可选的加密覆盖文件

生产部署的默认输入仍是 `/etc/bobuy.env`。仓库变量
`PROD_ENCRYPTED_ENV_ENABLED` 不存在或不等于 `true` 时，CD 不读取加密配置、不要求
SOPS/age，也不改变原有 `docker compose --env-file /etc/bobuy.env` 的行为。不要移动、
覆盖或删除现有 `/etc/bobuy.env`，也不要改动其中的值。

以下迁移由生产运维人员显式执行；示例只包含变量名，不包含任何凭据值：

1. 在隔离的运维机上生成专用于生产覆盖文件的 age 密钥。私钥的在线副本放在生产主机
   `/etc/bobuy/age/keys.txt`，目录权限 `0700`、文件权限 `0400`，并在既有受控离线备份中
   保存恢复副本。私钥不进入 Git、GitHub Secret、日志或命令行参数。
2. 创建临时 `production.env`。SMTP 配置骨架为
   `BOBBUY_ACCOUNT_MAIL_SMTP_HOST`、`BOBBUY_ACCOUNT_MAIL_SMTP_PORT`、
   `BOBBUY_ACCOUNT_MAIL_SMTP_TLS_MODE`、`BOBBUY_ACCOUNT_MAIL_SMTP_USERNAME`、
   `BOBBUY_ACCOUNT_MAIL_SMTP_PASSWORD` 和 `BOBBUY_ACCOUNT_MAIL_FROM_ADDRESS`。
   主机应配置为 `mail.briconbric.com`；端口和 TLS 模式由运维人员按 Mailcow 实际端点选择，
   不能只固定一个端口。不要把密码粘贴到终端参数；用不会记录输入的本地编辑器写入临时文件。
3. 使用生产 age **公钥**加密，然后立即安全删除临时明文：

   ```bash
   sops encrypt --input-type dotenv --output-type dotenv \
     --age AGE_PUBLIC_KEY --output production.env.enc production.env
   gh secret set PROD_ENV_SOPS_CIPHERTEXT < production.env.enc
   ```

   `AGE_PUBLIC_KEY` 只是命令中的公钥占位符；仓库仍可保留 `.sops.yaml` 的
   `age1REPLACE_ME`，绝不能用占位符生成生产密文。GitHub Secret 中保存的是 SOPS 密文，
   不是明文或 age 私钥。更新某个 secret 时，在隔离运维机解密到临时文件、编辑、重新加密，
   再执行同一个 `gh secret set … < production.env.enc` 命令；不要用 `--body` 把值放进参数。
4. 确认生产主机已安装 `sops`，且上述密钥权限正确。最后显式启用：

   ```bash
   gh variable set PROD_ENCRYPTED_ENV_ENABLED --body true
   ```

CD 仅在该变量为 `true` 时把 `PROD_ENV_SOPS_CIPHERTEXT` 的密文复制到生产主机。生产主机上的
`scripts/prepare-production-env.sh` 使用 `/etc/bobuy/age/keys.txt` 解密为权限 `0600` 的短期
Compose env 候选覆盖文件，部署使用 `/etc/bobuy.env` 加该候选文件，退出时清理候选文件；
脚本不输出内容。密文缺失、私钥
缺失、SOPS 不可用、解密失败或 dotenv 格式非法都会在替换容器前失败。覆盖文件不得包含
`BOBBUY_ACCOUNT_MAIL_DELIVERY_ENABLED`、`BOBBUY_ACCOUNT_PASSWORD_RESET_ENABLED` 或
`BOBBUY_ACCOUNT_REQUIRE_VERIFIED_EMAIL_FOR_CHECKOUT`，因此此配置批次不能开启正式邮件、重置或
验证门禁。`BOBBUY_ACCOUNT_MAIL_SMTP_PASSWORD` 目前只是保留的配置名称，不映射到任何容器；
本批不会读取或注入该密码，也不会启用外部邮件投递。

覆盖文件使用单行字面量赋值，支持完整闭合的引号及行尾注释；不支持变量插值，字面量美元符号
使用单引号包裹。准备校验与 CD Compose 配置校验失败时仅输出通用错误，捕获的诊断不输出。

部署前，CD 将上次成功部署的 `.cd/runtime-env-last` 复制到修订号专属的
`.cd/runtime-env-rollback-$REVISION`，确认源为普通文件且不是符号链接，并将副本权限设为
`0600`。回滚始终使用 `/etc/bobuy.env`，存在上述副本时再叠加该副本，恢复上次成功部署的
有效环境；首次加密部署尚无持久副本时，回滚仅使用 `/etc/bobuy.env`。回滚不读取本次候选
覆盖文件。退出清理会删除候选文件和回滚临时副本，失败保留原 `.cd/runtime-env-last`。

容器及 HTTP 健康检查成功后，启用覆盖文件的部署才通过同目录原子重命名将候选文件保存为
`.cd/runtime-env-last`；该文件为权限 `0600` 的普通文件，属于**仅保存在生产主机上的解密
明文材料**，不得复制离开生产主机或提交 Git，也不得输出到日志。成功的未启用覆盖文件部署
会删除该持久副本，避免以后回滚重新应用过期配置。此流程保持 `umask 077`，不修改基础
`/etc/bobuy.env`；运维需保持基础文件稳定，以便恢复相同的有效环境。

持久化后若部署回执写入失败，CD 会先从回滚副本原子恢复权限 `0600` 的持久文件；原先无覆盖文件
时删除新持久副本。恢复失败只输出通用警告，随后仍尝试镜像回滚。

回退到旧路径时只需执行：

```bash
gh variable set PROD_ENCRYPTED_ENV_ENABLED --body false
```

下一次 CD 的候选部署只用 `/etc/bobuy.env`，成功后删除持久覆盖副本；若该次部署失败，
回滚仍使用上次成功部署的覆盖副本。不要为回退修改现有环境文件。

手动发布器 `scripts/publish-production.py` 仅使用 `/etc/bobuy.env`。
只要 `/opt/bobuy/.cd/runtime-env-last` 存在或为符号链接（包括失效链接），
其 maintenance、reference-data 模式及数据库恢复入口均在变更前拒绝执行，且不读取覆盖文件内容。
此时请使用 CD，或将 `PROD_ENCRYPTED_ENV_ENABLED` 设为 `false` 并完成一次成功的 CD，
由 CD 删除持久覆盖文件后再使用手动发布器。
