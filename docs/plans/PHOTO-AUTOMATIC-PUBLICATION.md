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
