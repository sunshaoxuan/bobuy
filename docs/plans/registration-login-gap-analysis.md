# 注册、登录、邮件与账号恢复差距分析

> 调研日期：2026-11-15  
> 范围：backend、公开商城 storefront、商家/平台后台，以及相关配置、迁移与计划文档。  
> 交付边界：本文只记录源码事实与后续拆分，不修改产品代码或生产配置。文中仅列配置键和非秘密的产品默认值；不记录任何密钥、密码、连接串或可登录口令。

## 1. 结论摘要与已定产品规则

当前仓库已经有可用的用户名/密码登录、CUSTOMER 自助注册、JWT access token、服务端可撤销且轮换的 refresh session、HttpOnly refresh cookie、double-submit CSRF、登出、邮箱验证码和管理员邮件设置。公开商城有注册/登录及邮箱验证码界面，后台有统一登录页和平台管理员开户入口。

但它还不是完整的公网账号闭环：生产入口明确以 HTTP 503 关闭公开注册和邮箱验证；没有忘记密码/重置密码能力；登录、注册及邮件验证码缺少统一的 IP/账号级限流、验证码或渐进式锁定；现有下单逻辑没有检查邮箱验证；access token 仍在 `localStorage`；部分服务端错误是直接文本，四语和防止暴露内部 code 的边界不完整。

Parker 已拍板以下**默认产品规则**，不再是待确认项：

1. 验证邮件通过 Parker 的 Mailcow SMTP 发送，默认发件人为 `postmaster@bobuy.cc`。
2. 用户必须先完成邮箱验证，才能下单。
3. 忘记密码使用邮件链接重置。

这些是产品默认值，不应硬编码：SMTP 目标、发件人、验证后下单策略、重置链接的公开基址/有效期等仍须通过环境变量或受保护配置提供，以便以后调整。SMTP 密码尚未提供；其存储和使用必须依赖 issue #84 的加密存储，不得进入 Git、issue、报告、PR、日志或前端响应。

## 2. 现状清单

| 能力 | 判定 | 后端、模型与接口现状 | storefront 现状 | merchant/admin 现状 |
| --- | --- | --- | --- | --- |
| 注册 | **部分有** | `POST /api/auth/register` 与 `/register-account` 均公开于 Spring Security；两者最终都只创建 `CUSTOMER`，用户名/邮箱规范化并查重，密码 BCrypt 哈希。`bb_user` 由 lower(username/email) 唯一索引兜底。注册成功立即创建会话。AGENT/双角色只能由 `PLATFORM_ADMIN` 的受保护用户管理流程创建；无邀请制。 | `AccountForm` 有注册/登录切换；结账路径调用 `/register`，账户路径调用 `/register-account`，均不允许选择角色。 | `/admin/users` 是管理员手工开户/维护路径；`/admin` 登录不提供商家自助注册。种子/引导账号属于部署与本地演示，不是公开注册。 |
| 登录 | **已有** | `POST /api/auth/login` 以 username/password 登录，检查 `enabled` 和 BCrypt；签发 access token 与 refresh session。`GET /api/auth/me` 返回当前用户及 `emailVerified`。生产关闭 header auth。 | 账户页可登录；登录后加载 `/me`。 | 独立 `/login` 页面按 `platformAdmin`、AGENT、CUSTOMER 跳转。localhost/127.0.0.1 才显示本地测试身份覆盖。 |
| 登出 | **已有** | `POST /api/auth/logout` 撤销 refresh session，并无论结果清除 refresh/CSRF cookie；cookie-backed 请求要求 CSRF。 | 用户上下文调用后端后总会清除本地 access token、用户和过期时间。 | 与 storefront 共用同一上下文和登出流程。 |
| 会话/JWT | **已有，仍有风险** | HMAC JWT access token；默认 TTL 3600 秒。opaque refresh token 仅以 hash 持久化到 `bb_refresh_token_session`，默认 TTL 604800 秒，支持轮换、撤销、family 复用检测和并发保护。refresh 放在 HttpOnly cookie（默认 Path `/api/auth`；生产 Secure），CSRF token 放在可读 cookie并由 header 回传；服务端无 HTTP session。 | access token、用户及过期时间仍写 `localStorage`；refresh token 不写入 JS 存储。API 层可刷新并重试，用户上下文启动时用 `/me` 校验。XSS 仍可窃取 access token。 | 同 storefront。WebSocket 另用 access token，不属于邮件/恢复闭环。 |
| 邮箱验证 | **部分有** | 注册时生成 6 位码，只保存 BCrypt hash；10 分钟过期、最多 5 次尝试、60 秒重发冷却，成功写 `email_verified_at`；改邮箱会清除验证并使旧 challenge 失效。`POST /api/auth/email/resend`、`/verify` 需登录。 | 账户资料展示邮箱、验证码输入、重发冷却和已验证态。当前四语提示明确说“未验证也可下单”，与新规则冲突。 | 管理员用户管理可看到/维护账号资料，但没有替用户验证的公开自助流程；不应增加绕过验证的普通后台操作。 |
| 密码重置/账号恢复 | **没有** | 没有 forgot-password、reset token 模型、接口、邮件模板、一次性消费或全会话撤销逻辑。管理员可编辑用户，但这不是终端用户恢复流程。 | 无“忘记密码”入口、请求成功的防枚举页面或重置页。 | 登录页同样没有恢复入口。 |
| SMTP/邮件 | **部分有** | 旧的 `JavaMailSender` 默认是 `BOBUY_MAIL_HOST`/`BOBUY_MAIL_PORT` 与 `BOBUY_MAIL_FROM`；管理员 Mail Settings 支持受允许主机约束的 587 STARTTLS 或 465 TLS、加密密码、启用开关、测试收件人白名单及 60 秒测试冷却。验证邮件优先使用已保存且启用的设置，否则回落旧 sender。当前验证码模板按 locale 生成，但语言覆盖和链接生成仍不适合密码重置。 | 无邮件配置界面；只呈现发送/验证结果。 | `PLATFORM_ADMIN` 可编辑/测试邮件设置；密码不回显，依赖外部加密 key。现有 `MAIL-SETTINGS-20261112.md` 记录生产曾做自发自收测试且业务发信开关保持关闭，不能据此声称验证邮件已上线。 |
| 防滥用 | **部分有** | 有唯一索引、验证码 5 次尝试、60 秒重发、邮件测试 60 秒冷却、refresh 复用检测；注册密码 8–72 字符且额外限制 BCrypt 的 UTF-8 72 字节。没有登录/注册/忘记密码的 IP、账号、设备级限流；没有 CAPTCHA、失败渐进延迟/锁定、异常告警，也没有按目的地址的发送额度。重复用户名/邮箱当前返回明确冲突，可能用于枚举。 | 有基础表单校验，但无 CAPTCHA、节流反馈或标准 Retry-After 体验。 | 后台登录同样没有失败限流/锁定；管理员邮件测试的内存冷却不适合多副本全局配额。 |
| 下单验证门槛 | **没有** | `/api/checkout` 只要求 CUSTOMER、有效配送资料、行程/商品/报价；不检查 `email_verified_at`。 | 当前文案允许未验证下单。 | 商家订单流程没有替代终端用户验证规则。 |

### 2.1 数据与配置定位

- `bb_user`：`username`、`password_hash`、`enabled`、roles、`platform_admin`、`email`、`email_verified_at`。
- `bb_email_challenge`：每用户一条验证码 hash、发送/过期时间、尝试数；没有保留明文码。
- `bb_refresh_token_session`：token hash、family、轮换来源、客户端摘要、创建/最后使用/过期/撤销时间。
- 邮件设置持久模型保存非秘密 SMTP 元数据和加密密码；密文上下文绑定目标与发件身份，前端只拿到 `passwordStored` 等状态。
- 现有键包括 `BOBUY_MAIL_HOST`、`BOBUY_MAIL_PORT`、`BOBUY_MAIL_FROM`、`BOBBUY_SECURITY_JWT_TTL_SECONDS`、`BOBBUY_SECURITY_REFRESH_TOKEN_TTL_SECONDS`、refresh/CSRF cookie 配置与 CORS 配置。后续不得在文档里补入任何真实值或秘密配置。

## 3. 生产开关与实际未接线处

1. `infra/nginx/bobuy.conf` 在唯一公开入口对两个注册接口及 `/api/auth/email/**` 固定返回 503。Spring Controller 存在不代表生产可用。
2. `docs/production-deployment.md` 同样把公开注册标为等待 SMTP、防滥用和账号恢复 gate；因此 storefront 虽展示注册界面，生产提交会失败。
3. 管理员 Mail Settings 的业务发送 `enabled` 是独立开关。已有文档只证明受限测试邮件投递，不证明验证邮件开关已启用；源码回落到旧 `JavaMailSender` 也不应被当成正式 Mailcow 接线。
4. 生产 profile 要求外部 JWT secret、Secure refresh cookie，并固定关闭 header auth；本地测试身份覆盖只在 localhost/127.0.0.1 生效。
5. 邮箱验证目前不影响 checkout，且客户端提示允许未验证下单。要落实 Parker 规则，必须以服务端 gate 为权威，同时修改四语界面。
6. 忘记密码不存在，因而没有可开启的生产 feature flag；不能仅开放 Nginx 路由来补齐。

## 4. 差距与风险

### 4.1 关键阻断

- **恢复闭环缺失**：用户忘记密码只能依赖人工处理，既不可规模化，也容易诱发社工绕过。必须有防枚举请求、一次性短期 token、成功后撤销所有既有 refresh sessions，并保存安全审计事件。
- **新规则未落地**：后端 checkout 未检查验证状态；仅隐藏按钮或改文案会被直接 API 绕过。已有订单的幂等重试语义要与新订单 gate 明确区分。
- **真实业务邮件未接线**：Parker 的 Mailcow 与默认发件人已定，但凭据仍须等 #84；在加密存储、启用开关、失败降级与投递可观测性完成前不能开放注册。
- **公网防滥用不足**：注册、登录、忘记密码和邮件发送都可能被撞库、枚举或用于邮件轰炸；单 JVM 冷却不足以覆盖多实例与分布式来源。

### 4.2 安全、可用性与文案风险

- 注册与忘记密码响应若暴露“邮箱已存在/不存在”，会形成账号枚举；登录也应对未知账号和错误密码使用同一用户文案。
- access token 位于 `localStorage`，XSS 风险仍需通过 CSP、依赖治理和缩短 TTL 降低；本次规划不建议把 refresh token退回 JS 存储。
- 邮件验证码 hash 使用 BCrypt 且尝试数有限，但 6 位空间较小；重置密码应使用高熵随机链接 token，服务端只保存 hash，不能复用 6 位验证码机制。
- 邮件模板中的固定 `/account` 链接和语言选择需升级为可配置公开基址、四语模板、纯文本/HTML 安全转义及一致的过期说明。
- 当前有直接中文或英文服务端错误；界面可能直接显示这些文本或内部 code。所有后续实现必须把稳定条件映射为四语业务文案，绝不显示内部键名、错误码或未翻译英文 code。
- 生产 Nginx 的 503 文案仍是英文；开放前应由四语可理解的维护/不可用状态替换，而不是泄漏 ingress 实现细节。

## 5. 所有后续 issue 共用的验收条款

以下“共用 UI 条款”是 `docs/ui-ux-guidelines.md` §8 原文，所有含用户界面的 issue 必须**逐字纳入并全部验收**；不能用链接或摘要替代：

```text
功能与美观同时验收，须符合 docs/ui-ux-guidelines.md：
- 功能按本 issue 需求逐条通过，不改变未授权行为。
- 视觉与所在页面现有 UI 一致：复用已有 token 与组件，禁止原生未样式化控件，新控件与相邻控件齐高、同圆角档、间距统一。
- 具备默认 / hover / focus-visible / 选中或激活态；触控目标 ≥ 44px；键盘可操作；有可见标签或 aria-label；对比度足够。
- 四语文案（含较长的 en-US / ja-JP）在窄屏不溢出、不重叠。
- PR 附 390px 与 1280px 的改动区域截图（含关键状态）。Playwright 可用则用现有脚本或一次性检查生成。
- 主移动断点 767px 及 390px 下布局正常换行，无横向溢出。
- 只运行与本次改动相关的最小测试；PR checks 通过。
```

含 UI 的 issue 还必须按 §9 使用浏览器在 **390×844** 与 **1280×800** 实拍，并记录改动控件的计算 `width`、`height`、`min-width`、`min-height`、`border-radius`、边框、背景和阴影；圆形控件须证明计算宽高相等，以计算结果而非源码声明判定。纯文档/纯后端 issue 则必须明确写“无用户界面，§8/§9 不适用”。

此外，**每个实现 issue（无论是否有 UI）都必须带上：面向用户的界面不得展示内部键名、错误码或未翻译的英文 code；应使用四语文案。**

## 6. 可独立上线的后续 issue 拆分

### Issue A：定义账号邮件与恢复的可配置契约（纯后端/配置骨架）

**范围与独立发布理由**：增加不含秘密的配置契约、启动校验和环境模板：Mailcow SMTP 逻辑目标、默认 From `postmaster@bobuy.cc`、公开链接基址、验证后下单开关（默认 true）、重置链接 TTL。业务开关保持关闭，不发送邮件，可先安全发布。

**验收标准**：
- 默认产品规则与第 1 节一致，但全部可由环境变量或受保护配置覆盖；配置模板只含键名/占位说明。
- SMTP 密码读取必须依赖 #84 的加密存储；缺少加密能力时 fail closed，响应、日志、metrics、审计均不出现秘密。
- 明确旧 `BOBUY_MAIL_*` 回落的退役/兼容策略，避免已保存设置未启用时误走未经批准的 SMTP。
- 无用户界面，§8/§9 不适用。
- 面向用户的界面不得展示内部键名、错误码或未翻译的英文 code；应使用四语文案。

### Issue B：持久化的认证与邮件防滥用基线（纯后端）

**范围与独立发布理由**：为 login、register、verification resend/verify、forgot-password 建立按 IP 与规范化账号/收件目标的共享限流、渐进延迟、统一响应和审计，不开放生产路由即可先上线。

**验收标准**：
- 多实例下仍执行配置化额度和窗口；明确可信代理 IP 解析，不能信任任意客户端伪造转发头。
- 登录未知账号/错误密码、忘记密码邮箱存在/不存在不可被状态码、正文或明显时序区分；注册冲突策略经安全评审。
- 返回可供客户端本地化的稳定条件，但日志不记录密码、token、验证码或完整敏感邮箱；有合适的 Retry-After。
- 覆盖额度边界、窗口恢复、并发、代理头、枚举等定向测试。
- 无用户界面，§8/§9 不适用。
- 面向用户的界面不得展示内部键名、错误码或未翻译的英文 code；应使用四语文案。

### Issue C：Mailcow 验证邮件投递与四语模板（后端为主）

**范围与独立发布理由**：在 #84 完成后，把验证邮件固定走受保护的 Mailcow 配置，默认 From 为 `postmaster@bobuy.cc`，补齐四语模板、失败策略和可观测性；仍不开放注册入口，可独立做受控投递验收。

**验收标准**：
- SMTP host/port/TLS/username/from/reply-to 均来自配置，默认发件人符合已定规则；密码只从 #84 加密存储解密到最短生命周期内存，不回显、不记录。
- 验证邮件按用户/请求 locale 使用四语主题与正文；验证码仍为一次性、10 分钟有效、最多 5 次尝试，公开链接基址来自配置。
- 禁用、超时、证书错误、认证失败均 fail closed，并产生不含秘密/验证码/收件人全文的运维信号；不得悄悄回落未批准 SMTP。
- 受控收件人投递测试、重发额度和模板测试通过；业务发送开关可独立回滚。
- 若只改邮件而无页面改动：无用户界面，§8/§9 不适用。
- 面向用户的界面不得展示内部键名、错误码或未翻译的英文 code；应使用四语文案。

### Issue D：强制邮箱验证后才能创建新订单（后端 gate）

**范围与独立发布理由**：在 checkout 新订单写入前检查 `email_verified_at`，以配置开关承载已定默认 true；本 issue 可以先发布后端权威 gate 代码且不会开放注册，但不能把“强制验证”独立启用于生产。若 Mailcow 受控投递、`/api/auth/email/` 验证路由以及用户可完成发送/重发/验证与失败恢复的 UI 路径尚未同时可用，部署必须临时显式覆盖该开关为 false。只有这些依赖均通过验收并协同上线时，才可移除临时覆盖、按默认 true 开启 gate，避免既有未验证用户无法下单又无法完成验证。

**验收标准**：
- 未验证 CUSTOMER 创建新订单时，在任何订单/关系写入前拒绝；已验证用户不受影响，直接 API 无法绕过。
- 明确并测试同一 requestId 的既有成功订单幂等重试语义，不能因后续邮箱状态变化把已完成订单误报为新失败。
- 验证状态必须从受锁定/新鲜的用户数据读取；修改邮箱清除验证后立即重新受限。
- 配置的产品默认值仍为 true，并继续允许通过环境变量/受保护配置调整；生产启用前必须证明邮件投递、验证路由和用户可完成验证/恢复的路径均已可用，任一缺失时必须保留临时部署覆盖 false。
- 协同上线顺序为：先确认受控邮件投递可用，开放验证所需路由并提供可完成验证与恢复的 UI，再启用强制验证 gate；回滚任一前置能力时须先将 gate 覆盖为 false，且切换与回滚均不修改历史订单。
- 无用户界面，§8/§9 不适用。
- 面向用户的界面不得展示内部键名、错误码或未翻译的英文 code；应使用四语文案。

### Issue E：storefront 邮箱验证门槛体验（UI）

**范围与独立发布理由**：让购物车/结账在未验证时展示明确阻断、发送/重发/验证路径和恢复动作，删除“未验证也可下单”的旧文案；依赖 Issue D 后可独立上线。

**验收标准**：
- 未验证用户在结账操作附近看到四语原因、当前脱敏邮箱、验证输入、重发冷却及修改邮箱入口；验证成功刷新身份并可继续原购物车，不丢草稿。
- 邮件失败、额度限制、过期、错误码、离线和重复操作都有可恢复状态；不得仅禁用按钮而不说明缺项。
- 已验证用户无额外阻碍；改邮箱后立即回到待验证态。
- 本 issue 完整适用并须逐字纳入第 5 节“共用 UI 条款”；按 §9 在 390×844、1280×800 实拍关键成功/失败/冷却状态并记录计算样式。
- 面向用户的界面不得展示内部键名、错误码或未翻译的英文 code；应使用四语文案。

### Issue F：邮件链接密码重置后端闭环（纯后端）

**范围与独立发布理由**：新增 forgot/reset API、仅存 hash 的高熵一次性 token、四语邮件链接、消费事务和会话撤销。接口可在 UI 前发布但由生产路由/功能开关保持关闭。

**验收标准**：
- forgot 对存在/不存在/禁用账号返回不可枚举的相同响应；实际发信受 Issue B 限流并走 Issue C 的受保护 Mailcow。
- token 使用 CSPRNG、服务端仅保存 hash，TTL 与链接基址可配置；一次性消费、过期、并发双击、篡改均安全失败。
- 新密码满足统一策略和 BCrypt UTF-8 边界；成功提交原子更新密码并撤销该用户全部 refresh sessions，旧 access token 的剩余风险有明确处置（短 TTL 或用户安全版本）。
- 邮件和日志不含密码；URL token 不进入访问日志、Referer、分析系统或错误报告；重置页策略要求 `Referrer-Policy: no-referrer`。
- 无用户界面，§8/§9 不适用。
- 面向用户的界面不得展示内部键名、错误码或未翻译的英文 code；应使用四语文案。

### Issue G：登录页“忘记密码”与重置页面（UI）

**范围与独立发布理由**：为 storefront 与 merchant/admin 的共享登录体验增加请求页、通用成功态、重置页、过期/已用链接恢复；依赖 Issue F 后可单独发布。

**验收标准**：
- 两类登录入口均可到达；请求页无论账号是否存在都显示相同四语成功态，不泄漏枚举结果。
- 重置页面不把 token 写入 DOM 文案、持久存储、遥测或后续 URL；加载后清理地址栏 token，设置 no-referrer，密码与确认字段可访问且支持密码管理器。
- 成功后引导重新登录；过期/已用/无效、限流、网络失败提供四语恢复动作，不显示内部状态。
- 本 issue 完整适用并须逐字纳入第 5 节“共用 UI 条款”；按 §9 在 390×844、1280×800 实拍请求成功、重置表单、无效链接与完成态并记录计算样式。
- 面向用户的界面不得展示内部键名、错误码或未翻译的英文 code；应使用四语文案。

### Issue H：公开注册与邮箱路由分阶段开放（配置/运维）

**范围与独立发布理由**：在 A–G 的实现与验收 gate 均通过后，以可回滚的 ingress/feature flag 分阶段开放注册、邮箱验证和忘记密码；不在此 issue 引入新业务功能。这里的“Issue D 通过”指 gate 代码已验收，不表示应提前在生产强制执行：协同开放完成前必须以临时部署覆盖保持强制验证为 false。

**验收标准**：
- 前置证明包含 #84 加密存储、Mailcow 受控投递、防滥用、恢复、服务端验证后下单及 UI 四语验收；任一缺失则保持 503/关闭。
- 上线时先验证 Mailcow 实际投递，再开放 `/api/auth/email/` 验证路由及用户可完成发送/重发/验证与失败恢复的 UI 路径；三者均可用后才移除 Issue D 的临时覆盖并按默认 true 启用强制验证。任一前置能力不可用时，邮箱相关入口可保持 503/关闭，但强制验证也必须保持 false，不能阻断既有未验证用户下单。
- 先开放小范围/受控流量，检查注册、验证、重置、登录、下单与邮件失败指标；回滚只关闭入口，不删除用户、challenge、session 或审计数据。
- Nginx/网关和应用开关状态一致；维护响应为四语可理解状态，不暴露内部键或英文 code。
- 若只改配置且无页面改动：无用户界面，§8/§9 不适用；若修改维护页面，则完整适用并逐字纳入第 5 节共用 UI 条款及 §9 实拍/计算样式验收。
- 面向用户的界面不得展示内部键名、错误码或未翻译的英文 code；应使用四语文案。

## 7. 已定但保持可配置的产品默认值

| 项目 | 默认产品规则 | 必须保留的配置面 | 依赖与禁止事项 |
| --- | --- | --- | --- |
| 验证邮件 SMTP/From | Parker 的 Mailcow；From 为 `postmaster@bobuy.cc` | SMTP host、port、TLS mode、username、from、reply-to、启用开关；允许将来调整，但默认值须符合本规则 | 密码稍后提供，必须走 #84 加密存储；任何 issue/报告/PR/日志不得出现密码、密钥或连接串 |
| 下单前邮箱验证 | 必须验证后才能创建新订单 | `requireVerifiedEmailForCheckout` 等服务端配置，默认 true；客户端只反映服务端状态 | gate 必须在后端写入事务前执行；不能只靠 UI；历史订单及幂等重试不得被破坏 |
| 忘记密码 | 通过邮件链接重置 | 功能开关、公开基址、token TTL、邮件 locale/模板、成功后会话撤销策略 | 依赖 #84、Mailcow、防滥用；高熵一次性 token 仅存 hash，不使用验证码，不暴露到日志/分析/Referer |

## 8. 参考事实来源

- 认证接口与 cookie/CSRF：`backend/src/main/java/com/bobbuy/api/AuthController.java`、`backend/src/main/java/com/bobbuy/security/AuthCookieService.java`、`backend/src/main/java/com/bobbuy/SecurityConfig.java`。
- 注册、邮箱验证和 checkout：`backend/src/main/java/com/bobbuy/api/StorefrontController.java`、`backend/src/main/java/com/bobbuy/service/StorefrontService.java`、`backend/src/main/java/com/bobbuy/service/SelfProfileService.java`。
- 会话、用户和迁移：`backend/src/main/java/com/bobbuy/service/AuthService.java`、`RefreshTokenService.java`、`model/User.java`、`model/RefreshTokenSession.java`、`db/migration/V2__refresh_token_sessions.sql`、`V4__customer_storefront.sql`。
- 邮件：`backend/src/main/java/com/bobbuy/service/MailSettingsService.java`、`SmtpDelivery.java`、`VerificationMailTemplate.java`、`backend/src/main/resources/application.properties`。
- 前端：`frontend/src/pages/Storefront.tsx`、`LoginPage.tsx`、`AccountProfile.tsx`、`frontend/src/context/UserRoleContext.tsx`、`frontend/src/authStorage.ts`、`frontend/src/api.ts`。
- 生产入口与既有规划：`infra/nginx/bobuy.conf`、`docs/production-deployment.md`、`docs/plans/MAIL-SETTINGS-20261112.md`、`PLAN-28-P1认证与权限生产化开发提示词.md`、`PLAN-36-P2-RefreshToken与会话生命周期治理开发提示词.md`、`PLAN-37-P2-浏览器Token防护与Refresh并发硬化开发提示词.md`、`PLAN-61-统一用户与多类型管理.md`、`docs/reports/SELF-REGISTRATION-CUSTOMER-ONLY.md`、`POSTMASTER-CONFIG-PROPOSAL-20261027.md`。

## 9. 边界声明

本文没有读取、复制或记录任何 SMTP 密码、加密 key、JWT secret、连接串或真实账号口令；没有修改生产数据、产品代码、邮件设置、Nginx 或 feature flag。生产是否已具备某个外部配置不能仅凭仓库推断；本文只将可由源码与既有发布文档证明的状态列为事实。
