# 好物推荐自动翻译：运行依赖核实

本轮只读核实，不改变正在导入的152项内容、价格、库存、发表状态或服务运行。没有读取/展示密钥值，没有调用模型，没有读取生产管理员凭据，没有新建凭据、容器或付费服务。

## 结论

生产20261026.4的 ai-service 与 core-service 初始化状态均为 `configured=auto active=unconfigured`。ai-service 虽有模型名配置，但主模型URL、兼容API URL、明文密钥配置引用、加密密钥各部分/主密钥引用、Codex命令均未配置；容器也没有Codex可执行程序。core-service同样没有连接引用。仅检查了引用存在性，密钥值未返回。生产不存在 `bb_ai_connection` 表；原始工作树中的未提交AI设置实现并非线上能力，未混入发布。

因此目前没有可安全直接复用、已运行的持久翻译服务。离线456条译文导入不能替代自动翻译运行实现。个人桌面Codex会话也不等于已授权的生产API服务。

## 已有代码可复用什么

- `AiAgentController` 的 `POST /api/ai/translate` → `AiAgentService.translate` → `LlmGateway.translate` 已存在。LlmGateway支持Ollama、OpenAI兼容桥接以及显式配置的Codex命令。
- 无提供者时 `translate` 返回空Optional；控制器把它转成空字符串并返回成功响应。这不能当作翻译成功证据。
- 旧StockMaster的L10nInput是切换语言时的单字段建议，并不固定以日文为源；默认语言列表也不包含繁中。请求仅含text/targetLocale，没有持久任务、源版本、可靠失败状态或推荐批量待审流程。异常路径还有 `[Fallback] 原文`，不能将其当译文接受。
- .4推荐条目已具备日文原始字段、zh-CN/zh-TW/en-US译文、源指纹、MISSING/REVIEWED/STALE状态与正规批量预览/人工应用入口，可作为自动候选的最终审阅保存层。系统实际支持ja-JP/zh-CN/zh-TW/en-US。

## 最小服务选择与所需确认

1. **已有内部Ollama服务**：给出生产容器可达的服务地址、已部署模型；确认允许Bobuy长期调用及资源/并发上限。复用 `BOBBUY_AI_LLM_MAIN_URL` / `BOBBUY_AI_LLM_MAIN_MODEL`。若需开新网络入口、装模型或分配机器资源，应另行批准；目前未执行。
2. **已有获准的OpenAI兼容API**：给出基础URL、模型名、已有安全密钥引用，确认用于Bobuy持续翻译的权限、费用上限及仅外发公开商品文本的范围。复用 `BOBBUY_AI_LLM_MAIN_PROVIDER=openai-compatible`、`BOBBUY_AI_LLM_CODEX_BRIDGE_URL` / `...MODEL` / `...API_KEY`或既有加密引用。基础URL按现有实现连接 `/models` 与 `/chat/completions`。密钥应通过既有安全配置机制注入，不在聊天中发送，也不提取桌面登录凭据。

如果没有现成服务，选择提供商/预算和新长期凭据是缺少的真实决定；不能假称已有免费API、擅自花费或复制用户客户端认证。无需再次询问普通代码发布许可。

## 服务确定后的最小实现

复用LlmGateway网络适配与现有推荐审阅层，增加持久任务/候选层：日文保存或源文本变化后自动排队，以merchant/itemId/sourceHash/目标语言保证幂等；批量补齐旧项可由可见后台一次触发。生成zh-CN、zh-TW、en-US候选，保留人工校正/批量审阅；不因客户浏览调用模型，不直接覆盖已审阅译文或公开内容。

输入只取公开商品的日文名称、规格、介绍、适用条件；原信、收件人、账户、密钥、正文文章和原始邮件链接不进入模型请求。品牌/型号/编号/价格/计量单位/日期保持原结构化事实。营销文本作为不可信数据，不能改变指令或目标地址。输出校验支持语言、字段长度/完整性并保留失败状态；待审/失败/过期候选明确显示，源变化使旧任务失效。提交仍走正常可见页面及源版本检查，防止覆盖父当前并发导入。

先验证提供者可达/已有权限，再用合成公开日文做最小正向翻译测试；模拟超时/空响应/无效JSON/源变化/人工已校正/重复点击等负向测试。真实152项由父正常UI操作，不在工程脚本回填。实际售价与产品公开预订决定仍独立待答，不重试已拒PUBLIC操作。

本轮没有应用/配置变更，未重新跑无关应用门禁或重部署。配置存在性与实际provider状态摘要见 `evidence/recommendation-translation-dependencies/runtime-summary.json`。
