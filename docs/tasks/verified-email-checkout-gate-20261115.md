# Issue D：下单邮箱验证后端 gate（2026-11-15）

## 授权范围

- 仅在 `/api/checkout` 创建新订单前，以服务端受锁定的新鲜用户记录检查 `email_verified_at`。
- 保留相同 `requestId` 已成功订单的既有幂等重试语义。
- 使用既有 `bobbuy.account-mail.require-verified-email-for-checkout` 配置；产品默认值为 `true`，生产显式覆盖继续为 `false`。
- 不修改 UI、邮件发送、密码重置、Nginx、注册或邮箱验证路由，不写入密钥。

## 本批修改与最小验证

| 修改 | 最小验证 |
| --- | --- |
| 新订单写入前增加邮箱验证 gate | `StorefrontIntegrationTest`：开关开启时未验证用户经直接 API 被拒绝，订单及商家客户关系均不写入；已验证用户可下单 |
| 幂等检查先于新订单 gate | 同一 `requestId` 成功后清除验证状态，重试仍返回原订单；新 `requestId` 被拒绝 |
| 依赖受锁定用户的新鲜验证状态 | 已验证用户修改邮箱后立即以新 `requestId` 下单，被直接 API 拒绝且无新增写入 |
| 部署安全边界 | 静态核对产品默认值为 `true`，`application-prod.properties` 与 `compose.production.yml` 的生产覆盖均为 `false`，其余邮件/重置/防滥用开关仍为 `false` |

不运行前端、全项目、全栈或生产发布验证；本 issue 无 UI，§8/§9 不适用。
