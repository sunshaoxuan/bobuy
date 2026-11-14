# 期次来源 SHA-256 与来源产物

## 官方口径

`recommendation-issue-date-source-v1` 使用 SHA-256 对系统持久化的完整来源文件**原始字节**计算，输出 64 位小写十六进制。邮件来源的规范产物是 RFC 822/MIME（`.eml`，等价于 Graph `$value`）原文。不转换换行，不增删 BOM，不做 Unicode 规范化，也不重序列化 HTML。

无法取得 MIME 时，`recommendation-issue-date-source-html-utf8-v1` 对导入所得 `body.content` 原字符串的 UTF-8 字节计算；同样不规范化。产物记录 `sha256`、私有 `content`、`content_type`、`byte_length`、算法与取得时间，并以 `source_ref` 关联。正文不进入公开或工作台 API。

这套字节产物摘要与文章结构化字段哈希、商品目录哈希和条目发布 `reviewHash` 相互独立，不得混用。系统不连接或拉取外部邮箱；产物由既有导入管线写入或审核前受控取得。

## 兼容与交互

迁移只把已有审核记录标记为 `legacy-operator-supplied`，不重算、不覆盖历史哈希。新审核若找到已存产物，服务端重新核验产物摘要，以系统值保存；客户端显示只读自动回填和算法。没有产物时才接受 64 位十六进制手工值，并标为 `manual-source-unavailable`。日期、引用与合法摘要仍联合必填；未变化的已审核记录保持幂等。

## §8 / §9 验收

功能与美观同时按 `docs/ui-ux-guidelines.md` §8 验收：复用工作台组件与 token，具备键盘、焦点、≥44px 目标和四语窄屏布局，只执行相关最小测试。按 §9 在 390×844 和 1280×800 实拍来源可用只读、来源缺失手工、校验失败、已保存证据状态，并从浏览器记录目标控件的 width、height、min-width、min-height、border-radius、border-color/width、background-color 与 box-shadow；浏览器栈不可用时必须如实记录，不得以源码审查冒充。
