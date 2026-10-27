# RUNBOOK: 备份恢复演练

> 2026-10-27 候选更新：图片统一使用 PostgreSQL `bb_recommendation_image`；原对象存储服务已从候选代码与部署依赖移除。生产切换状态和回退步骤以 [PostgreSQL 18 升级与图片存储说明](../reports/POSTGRES18-STORAGE.md) 为准，不能直接把旧数据目录挂给18启动。


**适用范围**: 试运行 PostgreSQL、PostgreSQL 图片表、Nacos 配置与 `.env` 边界
**强约束**: 恢复验证必须在新库 / 新目录 / 独立路径进行，不得默认覆盖线上数据

---

## 1. 备份范围

必须纳入备份的对象：

1. PostgreSQL 业务库
2. PostgreSQL 图片表 对象数据
3. Nacos 配置源（`infra/nacos/config/*.yaml`）与运行态导出快照
4. `.env`（仅私有安全存储，不得提交真实 secret）

不纳入当前自动化范围：

- 自动定时备份任务
- 跨机房副本
- Secret Manager 自动轮换

---

## 2. PostgreSQL 备份

### 2.1 逻辑备份

```bash
cd /home/runner/work/bobbuy/bobbuy
mkdir -p /tmp/bobbuy-backup

docker compose exec -T postgres pg_dump \
  -U "${POSTGRES_USER:-bobbuy}" \
  -d "${POSTGRES_DB:-bobbuy}" \
  --clean --if-exists --no-owner --no-privileges \
  > /tmp/bobbuy-backup/bobbuy-$(date +%Y%m%d-%H%M%S).sql
```

### 2.2 备份验收

- 输出文件非空
- `pg_dump` 返回码为 0
- 记录数据库名、时间点、操作者

---

## 3. PostgreSQL 恢复验证

### 3.1 创建独立验证库

```bash
RESTORE_DB="bobbuy_restore_verify"

docker compose exec -T postgres psql \
  -U "${POSTGRES_USER:-bobbuy}" \
  -d postgres \
  -c "DROP DATABASE IF EXISTS ${RESTORE_DB};"

docker compose exec -T postgres psql \
  -U "${POSTGRES_USER:-bobbuy}" \
  -d postgres \
  -c "CREATE DATABASE ${RESTORE_DB};"
```

### 3.2 导入备份

```bash
cat /tmp/bobbuy-backup/<backup-file>.sql | docker compose exec -T postgres psql \
  -U "${POSTGRES_USER:-bobbuy}" \
  -d "${RESTORE_DB}"
```

### 3.3 恢复验收

```bash
docker compose exec -T postgres psql \
  -U "${POSTGRES_USER:-bobbuy}" \
  -d "${RESTORE_DB}" \
  -c "\dt"
```

最低验收标准：

1. 可成功连接恢复库
2. 关键表存在
3. 可读取订单 / 账单 / 用户基础数据
4. 验证完成后可删除恢复库，不影响主库

---

### PostgreSQL 图片存储

图片字节、内容类型、所属商家、访问范围及去重哈希统一存入 `bb_recommendation_image`。公开商品图保持原公开接口；采购凭证使用鉴权接口，不能用公开商品图接口读取。数据库备份包含图片，不再单独依赖对象存储；恢复后校验行数、每行摘要、图片二进制摘要和权限隔离。详见 [PostgreSQL 18 升级与图片存储说明](../reports/POSTGRES18-STORAGE.md)。

### 4.1 推荐方式：`mc mirror`

先准备 `mc` 别名：

```bash
```

执行镜像备份：

```bash
mkdir -p /tmp/bobbuy-backup/minio
```

### 4.2 备选方式：停机目录快照

仅在容器停机且确认无写入时执行：

```bash
cd /home/runner/work/bobbuy/bobbuy
tar -czf /tmp/bobbuy-backup/minio-data-$(date +%Y%m%d-%H%M%S).tgz data/minio
```

### 4.3 备份验收

- 可列出对象或目录快照
- 至少抽样 1 个小票 / 商品媒体对象存在

---

### PostgreSQL 图片存储

图片字节、内容类型、所属商家、访问范围及去重哈希统一存入 `bb_recommendation_image`。公开商品图保持原公开接口；采购凭证使用鉴权接口，不能用公开商品图接口读取。数据库备份包含图片，不再单独依赖对象存储；恢复后校验行数、每行摘要、图片二进制摘要和权限隔离。详见 [PostgreSQL 18 升级与图片存储说明](../reports/POSTGRES18-STORAGE.md)。

### 5.1 还原到独立目录或独立 bucket

推荐恢复到验证 bucket，而不是直接覆盖正式 bucket：

```bash
mc mb --ignore-existing bobbuy/${VERIFY_BUCKET}
mc mirror --overwrite /tmp/bobbuy-backup/minio bobbuy/${VERIFY_BUCKET}
mc ls bobbuy/${VERIFY_BUCKET}
```

### 5.2 恢复验收

1. `mc ls` 可列出对象
2. 抽样对象可预览 / 下载
3. 原正式 bucket 未被覆盖

---

## 6. Nacos 配置备份

### 6.1 源配置备份

```bash
cd /home/runner/work/bobbuy/bobbuy
tar -czf /tmp/bobbuy-backup/nacos-config-$(date +%Y%m%d-%H%M%S).tgz infra/nacos/config
```

### 6.2 运行态导出建议

如需要保留运行时已导入配置，可额外导出：

```bash
curl -fsS "http://127.0.0.1:${NACOS_HOST_PORT:-8848}/nacos/v1/cs/configs?dataId=core-service.yaml&group=DEFAULT_GROUP&tenant=" \
  -o /tmp/bobbuy-backup/core-service.yaml
```

> 运行态导出需按实际 dataId / group 执行；当前默认事实源仍以 `infra/nacos/config/*.yaml` 为准。

### 6.3 恢复验收

- `infra/nacos/config/*.yaml` 与导出文件可被重新导入
- `nacos-init` 可完成初始化

---

## 7. `.env` / Secret 边界

允许备份：

- `.env` 文件副本
- 仅私有受控位置保存

禁止行为：

- 提交真实 `.env`
- 把 JWT secret、数据库密码、PostgreSQL 图片表 secret 写入文档或仓库
- 把恢复命令写成默认覆盖生产环境

---

## 8. 整体恢复验收

恢复演练至少验证以下项目：

1. 服务可启动
2. 登录可用
3. 订单 / 账单核心数据可读
4. 小票 / 商品图片可预览

建议验收命令：

```bash
curl -fsS http://127.0.0.1/api/actuator/health/readiness
curl -fsS http://127.0.0.1/health
```

业务验收建议：

- 登录 `POST /api/auth/login`
- 查询订单 / 客户账单
- 打开 1 张小票或商品图片

---

## 9. 演练记录模板

```text
演练时间:
演练环境:
执行人:
备份对象:
备份命令:
恢复目标:
恢复命令:
验收结果:
- 服务可启动:
- 登录可用:
- 订单/账单可读:
- 图片可预览:
问题与偏差:
是否影响正式环境:
后续改进项:
```

---

## 10. Flyway 旧库 adoption / 回滚补充记录

如本次演练包含旧库纳管，还必须额外记录：

```text
是否存在 flyway_schema_history:
旧库 schema 是否与 V1 baseline 对齐:
是否启用 baseline-on-migrate:
baseline / migrate / validate 结果:
若失败，恢复到哪个验证库:
是否已验证恢复库关键表/关键数据:
正式环境是否仍保持未改动:
```

最低要求：

1. 没有真实旧库副本时，不得把 adoption 写成“已完成”。
2. baseline-on-migrate 只能执行一次性登记，且必须先有备份。
3. 恢复验证必须先在独立库完成，再评估是否影响正式环境。

---

## 11. 本次任务建议执行顺序

1. `docker compose config`
2. 启动 `postgres` / `nacos`（如环境允许）
3. 先做 PostgreSQL 逻辑备份
4. 恢复到独立验证库并验收
5. 再做 PostgreSQL 图片表 / Nacos 配置备份与恢复验证
6. 如涉及旧库 adoption，再补 baseline / validate / restore 记录
7. 把结果写入执行报告
