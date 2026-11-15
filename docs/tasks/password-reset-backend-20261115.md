# Issue F：邮件链接密码重置后端闭环

## 授权范围

- 仅新增 `forgot-password` / `reset-password` 后端接口、一次性哈希 token、四语邮件正文、原子消费与 refresh session 全撤销。
- 生产功能开关、发信、验证后下单和防滥用总开关保持关闭；不修改 Nginx、前端或用户可见流程。
- 缺少受保护邮件加密能力或投递关闭时静默 fail closed，不回落到其他 SMTP。

## 本批修改与最小验证

| 修改 | 最小验证 |
| --- | --- |
| token 持久模型、CSPRNG 与 SHA-256 hash、TTL、一次性并发消费 | `PasswordResetServiceTest` |
| 防枚举 forgot、受保护投递依赖、四语邮件链接 | `PasswordResetServiceTest` |
| 密码策略、原子改密与用户全部 refresh session 撤销 | `PasswordResetServiceTest` |
| 公开 API 与生产关闭配置 | `AuthControllerIntegrationTest` 的密码重置用例及配置静态核对 |

成功重置会撤销全部 refresh session。既有 access token 不可在当前 JWT 模型中即时撤销，按现有默认 3600 秒 TTL 自然失效；本 issue 不扩大到会话版本模型。邮件链接把 token 放在 URL fragment 中，避免 token 进入 HTTP 请求、访问日志与 Referer。
