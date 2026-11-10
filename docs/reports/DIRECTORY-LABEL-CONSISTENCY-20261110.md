# 目录日期层级修正：未发布

基点 ffcecf4b7e9f14c7543200290e76b72f42c58d21（现役c378源）。独立工作区 C:\Users\X02851\OneDrive - One人事株式会社\文档\ChatGPT\bobuy.cc\.task-tmp\directory-label-consistency-20261110；Bears c0347343及原冻结输入未修改。

## 需求、设计、证据、版本对应

- 用户11/9要求极简日期/公开件数/供应商和期次日期降序，11/10指出同位置文字不同；11/7强规则要求需求、设计、测试及版本记录齐全。此处用需求范围和明确来源约束实现，不把用户反馈当新载荷传输许可。
- 旧设计 docs/design/STOREFRONT-PINTEREST.md:40–41 明确目录尺寸、层级展开、触控/键盘、真实日期件数、服务/未知状态真实及分页；没有规定日历标签与右侧日期说明的统一层级、单行数量、来源缺失降级方式。因此有设计文档，不等于此处层级已有明确设计依据。
- 旧实现/旧测试/R3补丁说明有来源语义，但无证据证明用户批准堆叠三类说明。新规范 docs/design/ISSUE-DIRECTORY-DATE-HIERARCHY.md 是本反馈后的修订，不回填为历史设计。
- 新版本状态：本地未发布、无镜像/正式包、无上传。此次只改呈现和对应测试/规范。

## 数据及选择逻辑

- api.ts:1016 RecommendationSummary.publishedAt / issueDate / issueDateSource；1490 IssueDirectoryEntry。RecommendationService.java:37–42 从 post.publishedAt 与 reviewedIssueDate()/issueDateSource() 投影，未从标题或updatedAt推日期。
- PublicRecommendationBrowseService.java:18 Issue DTO，72行组成真实公开总数/供应商/日期；58–59行按issueDate倒序、null置后及稳定id倒序。当前补丁不改服务器顺序或日期数据。
- 现役 IssueDirectory.tsx 精确行号：[{"term":"const rows:Selected[]","line":27},{"term":"function dateParts","line":35},{"term":"function calendar","line":42},{"term":"function publication","line":46},{"term":"function dates","line":51},{"term":"function label","line":54},{"term":"issue-directory-date-kind","line":62},{"term":"issue-directory-published-at","line":67},{"term":"issue-directory-date-review-status","line":68}]。issueDate必须审核来源且DTO字段无冲突；有效LocalDate按UTC日历格式；缺失时只用带明确时区的真实publishedAt，转换Asia/Tokyo。
- 旧日历块类型标签、右侧主日期、副发布时间、待核对提示由四个独立条件渲染，导致语义虽区分却视觉堆叠。新显示：左侧仅日期数字，右侧一条准确来源日期；已审期次日优先，无时用明确JST发布日期。无两类事实时中性图标。无障碍名称保留完整来源信息。

## 为什么旧验收通过

- 旧 IssueDirectory.test.tsx 明确要求 date-review-status、date-note 和 issue+published双说明；November8/November9测试检查两类都可访问。旧测试未限制小卡仅一条可见日期。
- 原 .task-tmp/date-node-ui-combined-20261110/private-web-20261110/build-20261110T043342687Z/page-qa/native-r3/REPORT.md“新验收矩阵”把“待核对提示保留”当PASS；日期/JST/数据绑定/溢出和节点隐藏通过，并未提出同位置标签一致或文字密度门槛。现成390-fallback-readable.jpg是其旧期次读图证据，本任务未重新打开该图。
- 本次公网只读 index/目录JS/CSS全部200且与c378归档hash相同：PUBLIC-PAYLOAD.json（2026-11-10T10:01:47.836Z）。这只证明当前这些静态载荷一致，不冒充新的页面像素或全库验收。

## 实际验证与限制

- 组件R2 50/50唯一PASS，含新增8组四语×宽窄结构，核源日/发布跨JST日/缺值、单条可见日期、稳定原顺序/唯一当前项。未删除来源真实性、日期冲突或当前项断言。
- R1 41PASS/9FAIL保留 LABEL-TESTS-R1.json：旧可见提示断言尚未按新规范更新；R2只更新已移除提示的断言并保留无障碍事实检查。
- TypeScript session27690 exit0；1439语言键/引用/负例 session49883 exit0；git diff --check session69715 exit0。没有更改翻译值，四语复用现有准确来源标签。
- 截图实际像素 NOT_READ：官方Library引用/当前helper已取，默认Python启动失败；正常受控入口要求绝对目标后，以绝对消费路径唯一纠正，session84081在原helper os.setxattr失败（Windows Python无该API），未成功安装文件。没有手工下载/改helper/读取未完成临时文件。Library ID libfile_fde3_f-d66a5fc327e08191a871c4fa97e8a428_20d09b2ccab48191afc29127ca9db94a，file_000000007a3081fdbe91382f3cad2803，v0。
- 正式构建及真实358/375/390/1440四语视觉、独立QA NOT_RUN；本轮未开浏览器、JVM、Docker或数据库，未改生产数据/服务。
- 新载荷传输尚未申请或执行；旧c378特定上传同意不外推。本地修复不等待公开GitHub批准，不重试公开push/rawCDT/旧CDP。

## 变更记录

本次新增规范→移除重复可见日期类型/状态层→保留原数据和完整ARIA→8组新交互结构回归及旧相关用例对齐。当前为本地patch，不将历史报告改成通过新规范。
