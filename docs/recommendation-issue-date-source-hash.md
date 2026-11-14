# 期次来源 SHA-256 与来源产物

## 官方口径

`recommendation-issue-date-source-v1` 使用 SHA-256 对系统持久化的完整来源文件**原始字节**计算，输出 64 位小写十六进制。邮件来源的规范产物是 RFC 822/MIME（`.eml`，等价于 Graph `$value`）原文。不转换换行，不增删 BOM，不做 Unicode 规范化，也不重序列化 HTML。

无法取得 MIME 时，将来源 HTML 保存为 UTF-8 文件，使用 `recommendation-issue-date-source-html-utf8-v1` 对上传文件的原始字节计算；同样不规范化或重编码。产物记录 `sha256`、私有 `content`、`content_type`、`byte_length`、算法与取得时间，并以 `source_ref` 关联。正文不进入公开或工作台 API。

这套字节产物摘要与文章结构化字段哈希、商品目录哈希和条目发布 `reviewHash` 相互独立，不得混用。系统不连接或拉取外部邮箱；产物由既有导入管线写入或审核前受控取得。

## 兼容与交互

迁移只把已有审核记录标记为 `legacy-operator-supplied`，不重算、不覆盖历史哈希。新审核若找到已存产物，服务端重新核验产物摘要，以系统值保存；客户端显示只读自动回填和算法。没有产物时才接受 64 位十六进制手工值，并标为 `manual-source-unavailable`。日期、引用与合法摘要仍联合必填；未变化的已审核记录保持幂等。

本 PR 新增的 V36 保持算法列可空，不设置摘要/算法成对 CHECK，允许旧应用在切换及回滚期间更新摘要并省略新算法列。已审核记录的空算法读取为 `legacy-operator-supplied`，历史摘要保持不变。若测试环境已应用本 PR 先前版本的 V36，须重建该隔离测试环境以核对最终迁移；本次未对已部署数据库执行迁移或 checksum repair。

## 操作者附加来源文件

1. 使用所属商家的已登录账户打开待审核期次（包括尚无来源记录的 #11、#12），展开期次日期编辑器。
2. 填写邮件中的实际期次日期和有效来源引用：`https://...` 或稳定的 `message:key`。系统按当前输入的引用查询已存来源。
3. 点击“附加来源邮件或 HTML”，选择完整邮件 `.eml`（首选）。无法取得邮件原文时，选择 UTF-8 `.html` 或 `.htm`。文件须非空且不超过 10 MiB。
4. 上传成功后查看只读 SHA-256 和算法。系统按文件类型自动选择：`.eml` 或 `message/rfc822`（可带 charset）使用 v1；`.html`、`.htm` 或 `text/html` 使用 html-utf8-v1。类型冲突及其他类型会拒绝。
5. 核对日期及来源，勾选“我已审核”，点击保存。此流程无需手工计算或输入摘要。修改来源引用或重新选择文件后须重新勾选确认。
6. 重新打开可查看已保存日期、摘要及服务端审核记录。上传本身仅保存来源证据，保存审核后才改变期次日期。

私有 API：`GET /api/merchant/recommendations/{id}/issue-date/source?sourceRef=...` 查询草稿引用；`POST .../source` 使用 multipart 字段 `sourceRef` 和 `file`。两者先验证期次所属商家，只返回 `sourceRef/sourceHash/algorithm/sourceAvailable/hashEditable`。GET、PUT 及公开接口均不返回文件正文。相同引用、原始字节及算法可重复上传；已存引用或摘要存在冲突时返回 `409 SOURCE_ARTIFACT_CONFLICT`，禁止覆盖既有证据。相同文件须复用原来源引用。

## §8 / §9 验收

功能与美观同时按 `docs/ui-ux-guidelines.md` §8 验收：复用工作台组件与 token，具备键盘、焦点、≥44px 目标和四语窄屏布局，只执行相关最小测试。按 §9 在 390×844 和 1280×800 实拍来源可用只读、来源缺失手工、校验失败、已保存证据状态，并从浏览器记录目标控件的 width、height、min-width、min-height、border-radius、border-color/width、background-color 与 box-shadow；浏览器栈不可用时必须如实记录，不得以源码审查冒充。
