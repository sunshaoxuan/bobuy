# 本地敏感配置管理（SOPS + age）

## 本次授权范围与最小验收

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
docker compose config
docker compose up -d --build
```

Windows PowerShell 对应命令为：

```powershell
.\scripts\secrets-decrypt.ps1
docker compose config
docker compose up -d --build
```

解密脚本在原路径原子写入明文，不会把内容输出到控制台。若任一密文缺失、工具未
安装或私钥不可用，脚本会失败且不会替换已有文件。没有匹配私钥时，提交的密文无法
解密。本流程不触碰生产服务器 `/opt/bobuy/.env`，现有部署流程保持不变。

## 维护者提交密文前的往返校验

在安全工作区保存明文文件的校验值（不要粘贴到 PR），运行加密脚本，临时移走明文，
再运行解密脚本并在本机比较校验值。三份文件必须逐字节一致。确认后安全删除临时副本
和校验值文件；只暂存 `*.enc` 与本工具链的非敏感变更。
