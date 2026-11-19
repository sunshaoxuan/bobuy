# 分类树数据模型与兼容约定（issue #129 / child 1）

## 本批授权范围

本批只增加分类树节点、商品唯一主路径和旧平铺分类到新节点的对照能力。旧
`bb_category`（包括 `rec-cat-` ID）继续保留且可读；没有新路径的商品仍按有效的
旧分类解析，旧分类不存在或不可解析时才落入系统“未归类”桶。本批不改前台分类
浏览、后台树形管理、商品主档选择器或批量导入，也不导入或推测任何 Costco 分类。

迁移是追加式的，不更新 `bb_product`，因此价格、库存、公开状态、推荐期次与现有
URL 均不受影响。一个商品在 `bb_product_primary_category_path` 中至多有一行，从数据
库层面保证只有一条主路径。

## 兼容与“未归类”规则

解析顺序固定为：商品的新主路径、旧分类 ID 的显式对照、仍存在的旧平铺分类、
系统“未归类”节点。对照表允许 `cat-` 与 `rec-cat-` 等既有 ID 逐项迁移，但初始为空，
不凭空猜测业务分类。解析只产生分类归属，不更新商品，也不得以缺少新路径为理由
隐藏或下架商品。

“未归类”的用户可见名称为：zh-CN“未归类”、zh-TW“未分類”、en-US
“Uncategorized”、ja-JP“未分類”。内部 `system_key`、表名和节点 ID 不得显示给用户。
本批没有新增用户界面或交互；以上四语文案和不暴露内部 key 的约束按
`docs/ui-ux-guidelines.md` §8 验收。§9 的计算样式和截图验收不适用，因为本批不改
任何页面、样式或交互。

## 后续批次的日文 Costco 分类名展示约定

2026-11-15 晚间定稿：商城新分类树使用审核后的简体中文，`ja-JP` 使用日文原名；缺少审核译名时禁止把日文当作中文发布。后台保留日文参考。名称对照格式、待审文件及消费契约见 [分类导入文档](category-path-import.md)。此约定替代此前所有 locale 暂用日文的商城策略，当前不改变 #134 的浏览范围。

Costco 分类的权威原名存入 `ja-JP`。后台 zh-CN、zh-TW 与 en-US 缺少审核译名时可显示该日文原名供参考，
以免未经运营确认的翻译改变分类含义；只有运营提供并审核译名后，才在对应 locale
存入并显示译名。需要同时辅助理解时，采用“审核译名（日文原名）”格式，且搜索和
对照始终保留日文原名。不得自动音译、机器猜译或把内部 key 当作回退文案。

## 修改点与最小验证集合

| 修改点 | 最小验证 |
| --- | --- |
| Flyway 追加表、约束、系统节点与索引 | 针对 V40 的迁移结构测试 |
| 节点、主路径及旧新对照模型 | 模型单元测试 |
| 新路径 / 对照 / 旧分类 / 未归类解析顺序 | 兼容解析服务单元测试 |
| 文档和四语文案 | 静态审阅本文件，不启动前端或截图 |

## 2026-11-19：显式退役旧平铺分类（PR #162）

本节为后续新增授权，替代前述“旧分类永久保留”的批次边界。通用能力不按ID前缀、数量或商品ITEM猜测清理对象。云端开发和合成验收；本机唯一协调者选择真实范围、合并/CD、执行并验收。无新增独立后台页，已有前端价格、商品和推荐页面继续使用原接口。

### 兼容行为与边界

- V46仅新增`bb_retired_category`、操作回执及防重建触发器，没有DELETE/UPDATE现有业务行，也不随启动调用清理工具。未退役时旧应用继续正常工作。
- 活动类目选项只来自`bb_category`。已发布推荐/历史快照仍保留旧ID，`RecommendationTaxonomyService.display`用同商家退役档案补回原多语标签；档案不重新加入活动选项。没有重写推荐、发布快照、订单或恢复checkpoint。
- 推荐生成商品、档案提案和档案恢复过滤本商家已退役ID；原checkpoint仍完整保留。AI识别到已退役ID/旧名称时不猜新分类。旧客户端/导入写回当前商品的旧FK或JSON关联、或重建同ID/同商家tag_key分类会被数据库拒绝。
- 当前PUBLIC商品详情、后台列表及采购完成度按主路径解析；无主路径且旧关联已退役时为未分类。DRAFTER_ONLY参考目录不借用私人新路径扩大公开。HUD分类分组变化不改变数量、采购金额/利润或订单行快照。
- 清理仅改选中商品的`category_id`和`catalog_data.categoryIds`，保留数组中的其他ID及顺序、商品记录/软删状态、价格/库存/公开状态、record_version/updated_at和翻译审核指纹。清理是单独的维护审计事件；不使既有档案撤回checkpoint无故失效。陈旧分类写入由数据库保护拒绝；推荐发布审核hash包含完整catalog，旧审核不能借清理绕过复核。恢复checkpoint经过退役过滤，恢复原文而不重新挂退役类目。

### 固定工具与只读捕获

源码：[category_retirement.py](../scripts/category_retirement.py)，显式选择示例：[20261119-scope.json](../scripts/category-retirement/20261119-scope.json)。示例是本机指定merchant1001和16个字面ID，**不是生产捕获清单**，没有硬编码481/482/495作删除标准。工具可用于其他经授权的显式集合（最多200分类、10000个相关商品），任何缺失分类、跨商家/共享分类、未知外键消费者或不支持的数据形状均拒绝。

工具只依赖Python3标准库和`psql`。由执行者配置本机既有PGSERVICE/PG环境或通过`--psql-command-json`传入docker exec的argv数组；不使用shell拼接，不把密码放命令参数。云端不连接生产，不接收生产数据或凭据。

```sh
# 在本机协调者选定的安全任务目录运行；仅示例路径，先绑定实际连接。
umask 077
python3 scripts/category_retirement.py capture \
  --scope scripts/category-retirement/20261119-scope.json \
  --plan /secure/bobuy-task/category-plan.json \
  --receipt /secure/bobuy-task/category-capture.json
```

`capture`使用单一REPEATABLE READ、READ ONLY事务，捕获完整选定分类行、所有FK/JSON关联商品（含软删）、旧映射、这些商品的新路径、完整新树指纹，以及相关推荐/快照、checkpoint、订单和SKU指纹。查出的product_id集合才是范围；不会依计数扩选。清单以0600且拒绝覆盖已有文件方式保存，stdout只有摘要/数量，不打印行内容。清单摘要按规范JSON计算，修改任一字段即失效。

本机核对类别名称、所属商家、确切商品ID集合和映射范围；核对实际活动/软删数量与预期不一致的原因。此次已收到的只读证据为481活动+14软删，导出481集合相同，旧映射0；新树26+142保持原样，74160继续待分，HEAD三个ID各自独立。早期482观察来源未知，绝不通过补删一件凑数。云端不保存真实捕获清单，只接收必要摘要/执行回执。

### 部署、执行与读回顺序

1. 冻结同一PR源码/脚本，原生CI通过，由本机合并并让既有自动CD部署兼容版本。此时V46只增加结构，旧分类/关联尚未删除；自动CD健康失败仍可正常回退原应用。
2. 本机核实实际已运行Core源码revision/digest与兼容候选相符。`--compatible-revision`记录该**实际部署的40位源码revision**，是执行者已核实的声明，工具不冒充验证生产镜像。未完成切换不得执行apply。
3. 只读capture并审核清单及SHA。保留0600清单、脚本/SQL摘要、当前/可回退镜像digest及可用恢复资源。本工具提供有界比较恢复，不替代数据库灾难恢复备份。
4. 显式apply下列命令（SHA为capture回执的sha256，不是文件字节散列）：

```sh
python3 scripts/category_retirement.py apply \
  --plan /secure/bobuy-task/category-plan.json \
  --confirm-sha256 "$REVIEWED_CATEGORY_PLAN_SHA256" \
  --compatible-revision "$DEPLOYED_COMPATIBLE_REVISION" \
  --receipt /secure/bobuy-task/category-apply.json
python3 scripts/category_retirement.py status \
  --plan /secure/bobuy-task/category-plan.json
```

apply在一个事务内短暂锁定分类/商品/旧映射/档案表的写入，并共享锁住新树/主路径，防止JSON无FK新关联绕过范围检查；订单/推荐写入不被全局停写。锁等待最多5秒、语句最多30秒。再次比较整个捕获范围，归档分类原行、只清当前旧关联、删选定映射和分类、写入操作ID/清单SHA/执行数据库用户/兼容revision，再做完整读回。任何一步异常全部回滚，不能只删部分。相同操作/相同状态重复或并发请求返回PASS；范围变动则拒绝，不重新取数覆盖。

只读status区分NOT_STARTED/APPLIED/RESTORED及是否匹配before/after。发生进程超时、网络中断或回执文件保存失败时先查status，不因客户端错误推断事务未提交。工具会隐藏数据库错误中的SQL、行内容和连接细节；只输出安全的拒绝原因。

### 比较恢复与止损

```sh
python3 scripts/category_retirement.py restore \
  --plan /secure/bobuy-task/category-plan.json \
  --confirm-sha256 "$REVIEWED_CATEGORY_PLAN_SHA256" \
  --compatible-revision "$DEPLOYED_COMPATIBLE_REVISION" \
  --receipt /secure/bobuy-task/category-restore.json
python3 scripts/category_retirement.py status \
  --plan /secure/bobuy-task/category-plan.json
```

restore核对操作账本、历史档案原行和整个有界after状态一致，原子恢复分类/旧映射/商品原关联并读回；保留操作的应用/恢复时刻和执行身份。重复恢复在相同before状态下幂等。**任何范围内商品编辑/软删恢复、订单更新、推荐/检查点变化、新树或路径修改、档案篡改都会拒绝覆盖**；保持兼容版本运行，由本机调查后选择有界前向修复，不能用旧快照抹掉新业务写入。已恢复的旧计划不能再次apply，必须重新捕获审核新计划。

清理后旧Core不会读取退役历史标签，且旧恢复/导入路径会触发拒绝保护，所以不得直接使用旧rollback.yml切回不兼容旧Core。先通过上述比较恢复并验收旧关联，再切回配套旧应用；若恢复因新写入拒绝，则禁止盲回旧应用，保留兼容版前向修复。附加表/账本保留，不drop它们。首次自动CD在清理之前，故其自动健康回退不会碰到已清除的业务数据。

### 明确隔离演练与证据

相同工具的真实PostgreSQL演练入口：[test_category_retirement.py](../scripts/test_category_retirement.py)。它只使用命名容器`bobuy-category-retirement-test`的`category_retirement_synthetic`数据库；若数据库已存在则拒绝覆盖，每次只清理自己成功创建的测试数据库。不得修改连接到业务数据库。

```sh
docker run -d --name bobuy-category-retirement-test --network none \
  -e POSTGRES_HOST_AUTH_METHOD=trust postgres:18.6-alpine3.23
# 容器无外部网络和暴露端口；等pg_isready就绪后：
CATEGORY_RETIREMENT_TEST_PG_VERSION=18.6 python3 scripts/test_category_retirement.py
```

SQL演练已在PostgreSQL16通过，并按本机精确生产版本在18.6再执行一次通过：V1..V46真实schema、只读capture/状态、0600清单、范围/所有者/摘要负例、并发apply幂等、半途错误整体回滚、FK/JSON/tag_key重建保护、软删恢复正常、后续写入保护、档案篡改拒绝、恢复/重复恢复完整读回。应用定向45项通过，含历史标签、不可泄露跨商家标签、旧checkpoint恢复、导入防重生、AI不猜类目、采购总量/订单快照及公开/私人投影边界。前三项价格/UI证据按未变输入复用；第四项没有新增UI组件/样式，不额外启动无关浏览器回归。命令、hash和范围见[同批回执](reports/evidence/price-corrections-20261118/category-retirement.json)。

本机生产删除前的必需证据是实际capture清单/摘要、兼容部署revision/digest、对应范围恢复条件及执行回执。云端交付不等于真实清理已发生；生产执行与验收由本机完成。
