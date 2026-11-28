# 购物车请购批次二：站内短录音与转写

## 授权范围与候选边界

- 基线：`feature/cart-text-purchase-request` 的 `632288d8`；本批在独立分支 `feature/cart-audio-transcription-batch2`，不推动、合并或发布 #211。
- 只增加购物车请购的录完上传、转写稿编辑入口，以及顾客身份下的能力探测/上传端点；不做实时字幕、语音对话或生产配置变更。
- 现有 `LlmGateway` 只有文本/视觉生成路由，没有已批准且已验证的音频转写端点。本候选因此用 `AudioTranscriptionProvider` 明确隔离运行端适配器；默认无 provider 且 `approved=false`，能力端点返回关闭，前端隐藏录音控件并保留键盘/系统听写。契约测试使用确定性的 mock，不冒充真实 provider 验收。
- 2026-11-28 对当前仓库实现、应用配置引用和当前运行环境的**变量名**（不读取或改写秘密）复核：没有 `AudioTranscriptionProvider` 实现，没有 `BOBBUY_CART_AUDIO_*` 运行配置，也没有可证明已批准的语音端点；仅存在与音频批准无关的通用 OpenAI 路由变量名。因此本 PR 不接实际调用，能力继续关闭。待接条件是：提供方/端点与数据处理条款获批、适配器及模型明确、秘密由既有秘密设施注入、超时/取消可验证，并在真实环境完成 `approved` 与 `verified` 双门控验收。

## 实现与最小验证映射

| 修改 | 最小验证 |
|---|---|
| 服务端能力门控、按容器内容识别格式与时长、60 秒/5 MiB/并发/频率限制、provider 超时中断和临时字节生命周期 | `CartAudioTranscriptionServiceTest` |
| 顾客专属端点权限 | `CartAudioAuthorizationIntegrationTest` |
| 浏览器格式交集、权限/上传取消/失败重试、停止与离开释放音轨、转写回填后编辑 | `TextPurchaseRequest.test.tsx` 与定向 recorder 测试/浏览器验收 |
| 四语提示、44px 控件和窄屏布局 | i18n 检查、390×844 与 1280×800 截图及计算样式 |

## 运行与数据边界

- 录音只在用户点「录音」后调用 `getUserMedia`；录完后再次点「发送转写」才上传，发送前持续显示第三方披露。
- 浏览器仅从服务端公布 MIME 与 `MediaRecorder.isTypeSupported` 的交集中选择；这覆盖 iOS Safari 常见 MP4 与 Android Chrome 常见 WebM 的能力差异，不硬编码假设某格式存在。
- 停止、取消、组件卸载、页面隐藏/离开都会停止所有 `MediaStreamTrack`。Blob 只保存在组件内存，成功、取消、卸载或超限后清除；服务端只把 multipart 字节交给 provider，不落盘、不入库。
- 最终写入请购的是用户可编辑文本框中确认后的转写稿，沿用批次一购物车原文规则。

## 待真实设备/运行端验收与确切限制

1. **真实 provider 待验收**：须安装一个经批准的 `AudioTranscriptionProvider`，明确配置 provider id，并分别设置批准与真实验证开关；需验证真实端点、模型、密钥来源、超时和数据处理条款后，才能视为可启用。当前候选没有 provider、秘密或生产配置。
2. **真实设备证据待取得**：需在 HTTPS 的 iOS Safari 与 Android Chrome 各验证允许/拒绝权限、录制/停止、后台或离开释放系统麦克风指示、断网后保留可重试录音、转写后编辑。桌面模拟不能代替这些证据。
3. 服务端不信任文件名、multipart MIME 或客户端时钟：会解析 MP4/WebM 容器内容，要求声明格式一致，并以容器时长执行 60 秒上限及客户端时长偏差校验。畸形或无法取得时长的容器拒绝进入 provider。
4. provider 调用有独立超时，超时或请求线程被中断时会取消 worker 并释放并发许可；适配器仍必须响应 Java interruption，并为其网络客户端配置自身的连接/读取超时。
5. 频率窗口和并发信号量是单实例边界；多副本生产若批准启用，须换成共享限流器。临时上传仍受 Spring multipart 实现影响；本功能本身不创建持久文件，容器级 multipart 临时清理由运行时负责。

## UI/UX 标准验收条款

功能与美观同时验收，须符合 `docs/ui-ux-guidelines.md`：
- 功能按本 issue 需求逐条通过，不改变未授权行为。
- 视觉与所在页面现有 UI 一致：复用已有 token 与组件，禁止原生未样式化控件，新控件与相邻控件齐高、同圆角档、间距统一。
- 具备默认 / hover / focus-visible / 选中或激活态；触控目标 ≥ 44px；键盘可操作；有可见标签或 aria-label；对比度足够。
- 四语文案（含较长的 en-US / ja-JP）在窄屏不溢出、不重叠。
- PR 附 390px 与 1280px 的改动区域截图（含关键状态）。Playwright 可用则用现有脚本或一次性检查生成。
- 主移动断点 767px 及 390px 下布局正常换行，无横向溢出。
- 只运行与本次改动相关的最小测试；PR checks 通过。

## 交付门禁

这是独立云端候选。产品 PR 必须等待批次一门禁和本批自身门禁；本批不合并、不发布、不操作生产。
