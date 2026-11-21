# 现场照片自动归档与发布

## 部署接线与诊断

生产部署负责人在受保护的运维环境核对 Bobuy 专用视觉凭据引用及模型授权。使用现有 [SOPS 和 age 覆盖](../secrets-management.md)。由部署负责人设置 `PROD_ENCRYPTED_ENV_ENABLED` 并更新 `PROD_ENV_SOPS_CIPHERTEXT`，保留覆盖内已有设置。

- `BOBBUY_AI_LLM_CODEX_BRIDGE_URL` 必须为 `https://ccnode.briconbric.com:49530/v1`。`BOBBUY_AI_LLM_CODEX_BRIDGE_MODEL` 必须与既有批准模型及桥目录的精确模型 ID 一致。
- 通过受保护的 dotenv 注入获准的 `BOBBUY_AI_LLM_CODEX_BRIDGE_API_KEY` 引用，或按现有方案注入 `BOBBUY_AI_LLM_CODEX_BRIDGE_SECRET_{SALT,NONCE,CIPHERTEXT,TAG,ITERATIONS}` 与 `BOBBUY_AI_SECRET_MASTER_PASSWORD`。由部署负责人仅报告存在性。Core 运行照片 worker，保持 `BOBBUY_AI_COSTCO_WORKER_ENABLED=true`。
- 探针候选合入且准备验收时，只在技术运行环境启用 `BOBBUY_AI_COSTCO_VISION_PROBE_AT_STARTUP=true`。它使用随机色块合成图，在固定 HTTPS 节点验证模型目录、响应模型标识和像素内容。Core 只记录 `Costco photo vision probe:` 后的代码。成功为 `VISION_VERIFIED`。这个探针不建立商品或照片任务。受权商家的 `GET /api/ai/costco-onboarding/status` 仍是配置存在性检查。
- `ai.pinned_endpoint` 检查固定桥绑定。 `ai.pinned_credentials_missing` 检查凭据及 master 引用。 `ai.pinned_model_unavailable` 检查实际目录权限和精确模型。 `ai.pinned_vision_unattested` 或 `ai.pinned_response_model_mismatch` 请桥负责人检查图片输入和模型身份。 `ai.pinned_transport_or_protocol` 检查 TLS、网络和桥协议。当前已回报的生产状态为 `ai.pinned_endpoint`，模型的生产视觉能力待验证。

## 当前草稿范围

现有私有照片任务的 INTAKE 决策可保存可见标签原文、价格类别、商品外观和不确定性，并沿用该任务原图证据哈希。官方 FACTS 可保存四语文本和实际取得的官方文本哈希。旧任务允许这些字段为空。本草稿尚未接入自动写商品或公开发布。

公开发布需要确定图库图片授权记录及审计语义，使用适用 SKU 的获准售卖规则，并完成自动写入、历史恢复和公网上回读测试。当前代码将现场采购参考价与 BoBuy 售卖价分开。生产技术验收使用授权隔离样本。两张历史照片由协调者在发布阶段只读核对原图，授权复验时沿原任务 ID 继续。

## 原图留存与补图

生产只读核对发现持久队列可查到的历史照片均从 11 月 21 日开始。商家排除的两张当天维护照保存着完整价签，不能用它们证明更早一次 AI 拍照已找回。另一个任务的完整私有图为白底包装构图，重试沿用其已保存的哈希。从存储记录无法认定该文件当时由哪个拍照入口、相册选择、或站外来源进入。

商品档案的相机和相册入口均读取选中的浏览器文件。PNG 和 JPEG 入队前保持原文件，其他受支持格式按现有规则转换，且入队前没有取用图库商品图的分支。后端先在私有证据存储中保存提交字节，再按商家、供应商、市场和提交字节散列建立或复用任务。识别、官网检索、预览清洗及保存文件为不同路径。队列和确认预览完整呈现取景，同时保留既有的相册分享和文件下载操作；服务器导出的安全版本可能经过格式转换或去除元数据。旧即时商品扫描和推荐扫描在识别阶段都没有原图存档。旧商品流程在建档确认时才保存，推荐流程还需要选择照片并保存；历史单次入口无法仅由现存日志确定。现行商品档案入口已在识别前私有入队，旧即时扫描和推荐存档是否统一仍需接续。

仅包装构图时保留初步商品辨识线索，任务标记缺店内价签；用户可在原任务补拍或上传价签。补图对同一任务 revision 执行条件更新，归档原图及旧尝试；之后的识别用当前图读价签，将最初的包装图作为识别上下文。已有现场图的原任务重试沿用其当前照片。现场图和官网商品图使用独立端点及显式标签。

浏览器验收使用两张合成图，一张价签贴右下边缘，另一张为无价签包装构图。手机以实际设备验证相机、系统文件分享中的存储图像、关闭并刷新后从队列回读，以及识别失败时照片仍可下载。真实价签的模型核对由技术运行方接通获准凭据后与商家协调执行。开发阶段使用隔离数据。
