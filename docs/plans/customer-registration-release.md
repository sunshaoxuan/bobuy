# 客户注册发布候选

范围来自本轮授权。账户页和结账共用客户注册服务，继续沿用现有登录、验证、结账及角色契约。注册邮件走 Core 现有受保护的 Mail Settings，复用 #177 和 #154/#157 中适用的邮件实践。密码重置独立发布。

| 修改 | 最小验证 |
| --- | --- |
| 注册和验证码路由、运行开关与生产边缘门禁 | 精确网关路由测试、生产配置静态检查、主会话关闭态和开通后真人验收 |
| SMTP 提交、关闭连接与测试审计边界 | SMTP 聚焦测试，验证已接受邮件在关闭连接失败时仍成功，检查未确认提交的分类 |
| 注册清理授权、依赖保护 | 管理接口集成测试覆盖精确归属、业务依赖、重复调用、权限和会话/验证码清理 |

无用户界面改动，§8/§9 不适用。生产操作由主会话执行。

## 现有契约

- 账户页 `/account` 走 `POST /api/auth/register-account`，结账表单走 `POST /api/auth/register`。两者创建仅含 `CUSTOMER` 角色的账号，验证前立即返回现有 bearer 会话和 Refresh/CSRF cookie。新账号可进入客户范围页面、修改资料及调用验证，商家和平台管理权限仍按现有角色授予。
- 验证邮件使用四语模板及公开站点基址。六位码有效 10 分钟，最多五次核验，重发间隔 60 秒并替换旧验证码。核验依赖已登录会话，成功后客户端刷新资料，退出后仍可用原用户名和密码登录，验证状态保存在账户上。
- 生产下单验证开关维持关闭，未核验邮箱本身不阻断下单，其余客户与结账规则照常生效。结账已有未验证提示与前往账户页的链接。若另行决定强制验证后才能下单，需协调后端 `BOBBUY_ACCOUNT_REQUIRE_VERIFIED_EMAIL_FOR_CHECKOUT` 与前端构建参数 `VITE_CHECKOUT_EMAIL_VERIFICATION_ENABLED`，并单独验证已有客户的下单行为。
- 生产 Nacos 的精确路由要先于 `/api/auth/**`，只把两条注册及重发和核验转到 Core。现有登录、刷新和独立的密码重置路由仍走 Auth。密码重置开关在生产属性中继续为 `false`。

## 投递与旧回执

已知 2026-11-21 JST 的旧邮件在 00:14:31 有 Mailcow 接收头，00:14:42 应用记录测试失败，00:14:56 到达邮箱。旧代码将 SMTP 异常和成功审计写入异常合并成同一个 `TEST_FAILED`，并丢弃底层错误。该证据说明匹配邮件已送达，现有回执无法确定 HTTP 400 的具体阶段。锁定的 Spring Framework 6.1.5 发送器会在邮件提交之后关闭连接，关闭异常可能被上抛为发送失败。Angus 2.0.3 在 DATA 末尾等 250，关闭阶段默认等 QUIT 答复。这证明旧路径可能在已接收后报错，无法据此认定本次是 QUIT 失败。[Spring 源码](https://github.com/spring-projects/spring-framework/blob/v6.1.5/spring-context-support/src/main/java/org/springframework/mail/javamail/JavaMailSenderImpl.java#L427) · [Angus 源码](https://github.com/eclipse-ee4j/angus-mail/blob/2.0.3/providers/smtp/src/main/java/org/eclipse/angus/mail/smtp/SMTPTransport.java)

候选在 SMTP 正向提交返回后保留成功结果，连接关闭失败只记 `CLOSE_AFTER_ACCEPT`，成功审计写入失败有独立日志。提交阶段若丢失最终答复记 `SUBMIT_UNKNOWN`，先查 Mailcow 队列/投递和收件箱再决定人工重试。连接、认证、明确 SMTP 拒绝和配置失败有独立类别，日志仅使用类别或设置版本。原连接、读取及写入超时维持 5 秒。

后续独立外部测试已记录 SMTP 接收正文和 QUIT 221，随后收到 Outlook 的 DSN `550 5.7.1 S3150`。SMTP 接受仅表示 Mailcow 收件，Microsoft 发信网络阻止仍会挡住后续投递。单次自发自收成功或应用返回成功不足以开放注册。

## 生产配置与受控验证

1. 当前基线为 `d5d608d10810f2ac7a19553942bb55c695ab685c`（CD [44783219786](https://github.com/sunshaoxuan/bobuy/actions/runs/44783219786)）。先审核候选与 CI，再由主会话执行发布。保留当前镜像、Nacos `gateway-service.yaml` 原值和环境文件的已验证恢复方式。V47 新增空表，Core 应用 Flyway，旧应用可忽略该表。
2. 默认关闭部署时，保留三项 `BOBBUY_ACCOUNT_REGISTRATION_ENABLED`、`BOBBUY_ACCOUNT_REGISTRATION_TEST_ENABLED`、`BOBBUY_ACCOUNT_MAIL_DELIVERY_ENABLED` 为 `false`，且边缘标记缺失。正常 CD 更新 Compose 与 Nginx，现有 CD 不上传或发布 Nacos 配置。使用现有 [Core 精确路由发布方式](../reports/ACCOUNT-PROFILE-404-20261111.md) 发布对应提交的单个 Nacos 数据项，回读并确认路由顺序。两条注册和验证码路径保持 503，已有登录、刷新和页面正常。
3. Core 继续读取 #177 的只读密钥挂载及数据库中已有的加密 Mail Settings 记录。以平台管理员打开该记录的 `enabled`，保留现有服务器、身份和已保存密码。先在 Core 的现有管理端固定收件人测试入口做一次受控发信，核对 HTTP、审计类别和实际收件；实际外部收件须另外验证，尤其是此前拒收的 Outlook。不要使用或新增 #157 的另一套环境 SMTP 凭据。
4. 注册验收需要在 Core 的实际部署环境文件中设置 `BOBBUY_ACCOUNT_REGISTRATION_TEST_ENABLED=true`、`BOBBUY_ACCOUNT_MAIL_DELIVERY_ENABLED=true`、`BOBBUY_AUTH_ABUSE_ENABLED=true`，并保持 `BOBBUY_ACCOUNT_REGISTRATION_ENABLED=false`。默认 `BOBBUY_REGISTRATION_CLEANUP_ACCOUNTS` 为空。为这次验收预先配置由主会话控制的两个唯一测试用户名和邮箱，格式为逗号分隔的 `username=email`，每个入口使用不同账号。重建 Core 后核对候选镜像、V47、健康和环境键。现有防滥用使用数据库 IP 和目标配额，准备切换前按实际边缘与网关直连对端配置 `BOBBUY_AUTH_ABUSE_TRUSTED_PROXIES`，验证共享代理后能区分客户 IP。容器缺省不会信任转发头，不能直接把代理地址当作客户 IP 来开启公开注册。Auth 的 Compose 值仍为 false，现有公开登录继续走 Auth。
5. Compose 仅将这些注册与投递设置注入 Core。旧 `application-prod.properties` 硬编码会遮盖基础属性中的同名占位符。候选的生产属性直接引用相应环境变量并默认 `false`。使用 CD 相同的 `/etc/bobuy.env` 和已启用时的加密覆盖顺序，覆盖文件中同名设置优先。凭据仍只从现有 Core Mail Settings 链路读取。默认 `BOBBUY_ACCOUNT_PUBLIC_BASE_URL` 为 `https://bobuy.cc`。
6. 受控确认前，可在主机现有只读 ACME 挂载的来源创建空标记 `/opt/bobuy/data/acme/.customer-registration-open`。确认 Nginx worker 可遍历此挂载路径并读取标记文件属性。Nginx 按请求判断该文件，不需要重载。测试模式下只有两组精确身份可注册；任意其他身份必须仍返回 503。逐一用独立浏览器会话检查两条入口、验证前角色和页面访问、实收验证码、冷却及重发、旧码失效、正确码核验、已验证状态、登出并重新登录。不创建订单。测试邮箱只使用主会话控制的地址。受控验收通过、主要外部收件域实际送达且主会话批准后，才能将 Core 的公开开关改为 `true` 并关闭测试模式。
7. 需立即止损时删除边缘标记，四条请求恢复 503。若仅停止新注册并保留现有用户验证，关闭 Core 的公开与测试注册开关，保留边缘标记和业务邮件设置。若停止发信，关闭 Core 业务邮件开关并把 Mail Settings 恢复为原先禁用。回退网关配置至候选前备份时先移除边缘标记；兼容应用回滚保留 V47 及已写账户，禁止恢复旧数据库覆盖新客户写入。

## 精确清理

- 管理员从 `GET /api/admin/users` 取得本轮记录的 ID、规范化用户名及邮箱，逐个调用 `DELETE /api/admin/users/{id}/registration-test`，使用正常管理员 bearer 会话和 JSON 请求体 `{"username":"<exact username>","email":"<exact email>"}`。保持验收名单至清理完成。成功返回 200；同一 ID 再请求应为 404。账号需在两个入口之一成功注册时命中清理配置，且凭据之外的身份必须与最初服务器记录和当前配置同时匹配。
- 该接口仅限平台管理员，并拒绝自删、管理创建/编辑过的账号、不在名单的账号、非纯客户账号，以及已有订单、付款、商家关联、评论、订单变更回执或聊天的账号。删除在与会话签发、验证码和结账共用的用户锁内事务执行。业务外键是额外并发保护。只清理目标账号、会话、验证码、账号恢复令牌及专用身份记录。安全与业务审计记录保留。
- 确认管理员列表无该 ID，测试 bearer 与刷新 cookie 均已失效，然后移除清理名单和测试模式。未获公开授权时一并撤下边缘标记并关闭业务邮件设置。候选验证不触发真实生产发信、开户或删除。

## DATA 确认恢复

一次受控注册的邮件已送达，但接口返回 HTTP 400，账号事务回滚。邮件服务的正文扫描接近 6 秒，单项已超过旧客户端 5 秒读取时限。客户端在提交阶段断开，随后外部邮箱确认收件。外部邮箱的接收结果和应用等待的 Mailcow 最终 DATA 回复属于两段 SMTP 会话。

Core 的 `BOBUY_MAIL_SMTP_READ_TIMEOUT_MS` 默认 15000 ms，可按实测在 5000 至 30000 ms 内配置。15 秒为这次约 6 秒的服务端处理留出余量。Angus 的 `mail.smtp.timeout` 限制单次套接字读取，连接和写入各维持 5000 ms，网关与边缘读取配置保持原值。超出支持范围时 Core 启动会拒绝该配置。使用正常部署环境文件注入及重建 Core，候选关闭态可保持默认；需要回退时使用上一精确镜像或已验证配置。缺失最终确认的提交仍属于 `SUBMIT_UNKNOWN`，需核对队列与收件箱再操作。明确拒收仍回滚，应用没有自动重发。现有管理端邮件测试的审计写入独立于已确认的 SMTP 结果。

隔离 SMTP 回归在正文结束后等待 6 秒再回 250，验证单次提交、账号持久化、会话与邮箱中的原码核验。另用 DATA 后 550 验证拒收回滚。本轮保留同步注册事务、权限、防滥用、原清理与门禁。超过新阈值或丢失最终回复仍可能产生孤立邮件，必要时作为独立故障处理。主会话已收回 canary、确认三个试验身份均未创建并还原 Mail Settings。Outlook 的 S3150 仍单独阻塞公开开通。

## 独立邮件探针候选

#154 的 GitHub 手动探针只验证现有 Core 到 Mailcow 的固定 Postmaster 自发自收。验证范围为 Core 循环回源与现有服务令牌双重限制、固定发件人与收件人、业务开关关闭时的合成发信、共用冷却和脱敏失败回执。仅准备候选，发布或手动运行需单独授权。

GitHub 的 **Send production test email** 只从官方 main 手动运行，复用生产 CD 的现有生产环境及 SSH 主机校验，使用独立并发组，避免替换排队中的 CD。运维应在部署完成后另行批准测试。它在 Core 容器内部使用现有服务身份访问循环回地址。Core 仅在现有白名单与已保存发件人都允许 Postmaster 时尝试一次发送。Core 使用 actor 0 记录工作流测试审计，GitHub 运行记录提供触发者身份。失败输出是固定类别，`SUBMIT_UNKNOWN` 或 `UNCONFIRMED` 时先查邮件队列及收件箱再决定是否人工重试。业务开关可以保持关闭。
