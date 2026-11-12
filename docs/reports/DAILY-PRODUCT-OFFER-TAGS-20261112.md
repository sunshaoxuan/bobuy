# 每日商品优惠标记同步

## 主目标与用户要求
每天日本时间 01:00 轮询全部商品，为生效中的优惠添加“优惠”标记，清除已过期优惠对应的标记。

## 方法与范围
用户已纠正：要求网站后台的服务器定时任务，删除此前误建的 Codex 自动任务。实现服务器每日日本时间 01:00 的优惠标记同步，复用现有商品、优惠事实及标签模型。核对当前主线及生产版本，在隔离工作区实现、测试、通过项目发布门禁并部署服务器，验证实际运行配置与同步效果。不修改价格、库存、优惠事实、其他标签或发布状态，不创建新的测试栈。记录检查和变更数量，验证幂等及并发安全。

实现采用服务器 systemd timer、Python 标准库执行器和单事务 SQL，复用现有 PostgreSQL 容器与认证。无需新增依赖、持久化数据库结构、应用镜像、网站重启或 UI 修改。SQL 临时函数和临时表仅存活于当前连接。该实现属于服务器后台任务，不依赖 Codex 或本机在线。范围是此次授权的优惠标签业务更新，不适用基础档案导入流程，也不触发无关应用全量构建。必要正式检查为本批脚本单元测试、真实 PostgreSQL 行为及并发测试、systemd 配置验证、源码与安装字节绑定、生产首次执行和幂等复查。网站应用、数据库 migration 和前端文件均保持原样。

数据库采用固定时点的 REPEATABLE READ、事务 advisory lock、按 ID 排序的商家 user 行锁及商品行锁；与现有管理端 ProductMarkerService 的 user 锁协议一致。锁等待上限 5 秒、SQL 60 秒、执行器 90 秒、systemd 100 秒。并发写冲突直接失败并回滚，不伪报成功或盲重试。普通读取继续可用，无全局停写和数据库恢复。日志保留标签前后状态及版本，发生后续写入时只允许按版本核实后的局部修复，禁止旧快照覆盖业务写入。

优惠来源包括同商家已发布推荐的不可变发布快照，以及实际销售价格中已审批且处于生效区间的减价。复用 ReferenceOfferWindow、referencePriceDisplay、RecommendationPublication、ProductSaleService 的领域边界：商品编号精确匹配，推荐普通参考价格不证明有优惠，优惠日期和券发放日期分开。多个来源 ACTIVE 优先于 UNKNOWN，再优先于无当前优惠。未知事实计入待核实并保留当前标签；明确结束日期已过，即便开始日期缺失也可证明已过期。禁用的优惠标签定义保持禁用并计数。缺少定义时仅为需要优惠标签的商家补建现有 discount 默认定义；每次更新仅增减此 ID 并递增 marker set 乐观锁版本。商品及其他业务字段不写入。

实时生产前检：Core revision `b3caeec8c0b04a3144339f8e84ab334b53f81aa1`，镜像 `sha256:05cd202ae182bf3995622e85f255ee2daf2261444605fff7d7771e1e40d599d3`，Flyway V34，389 个未删除商品、385 条已发布推荐商品、0 条商品标签分配、0 条销售价格调整；现有 discount 定义已启用。证据为 evidence/daily-product-offer-tags-20261112/server-before.json。

外部建议按项目规则执行：Claude `claude-opus-5-5-high` 可见，最小请求及一次重试均返回 no available accounts；转向已验证可调用的 `deepseek-flash` high 获得只读风险建议。主 Agent 审核后采用固定快照、有限超时、真实 PostgreSQL 并发和失败回滚测试，不向外部模型传递认证、业务记录或完整对话。外部建议不是测试通过证据。

时间采用 Asia/Tokyo。日期型结束日包含当天，次日失效；明确时间戳按其时区比较。只有现有有效优惠事实支持的商品才添加标记；未开始的优惠不添加。未知日期或冲突按已有业务规则处理，无法确定时保持该商品并报告，禁止推断缺失优惠事实。优惠标记必须代表当前有效优惠，过期记录与当前有效记录并存时保留标记。

## 完成标准与必要验证
1. 删除 ID 为 bobuy 的 Codex 自动任务。
2. 后台任务在服务器每日日本时间 01:00 执行，全部商品覆盖、有效期边界及其他标签保留均有测试。
3. 验证真实数据持久化、幂等及异常处理，通过项目必要门禁。
4. 发布到服务器，核对实际版本、任务启用及运行证据；区分部署完成、手工验证和首次定时触发。
5. 保留无关工作区改动。没有证据的项目记录为未完成。

## 当前验收
此前创建 Codex 自动任务属于执行目标理解错误，其创建结果不满足用户目标。ID `bobuy` 已通过 automation_update delete 删除，工具返回 deleteStatus=deleted。服务器任务代码已实现，测试及生产验收进行中。

第一轮真实 PostgreSQL 11 项测试通过，198.503 秒，覆盖 205 个商品、两个商家、删除商品排除、JST 日期、时刻半开区间、已发布快照与身份隔离、有效/未知/失效混合、活动继承、券日期分离、幂等、其他标签、定义禁用、50 标签上限、advisory 锁、后台并发写及错误回滚。执行器 3 项单元测试通过，覆盖提交回执、只回滚试运行、数据库失败、超时及非法输出不报成功。

冻结前复核新增严格 ISO 日期及不合法原价保护，补充锁等待超时负例，修复测试管道资源关闭。由于 SQL 判断输入变化，原 SQL 测试证据失效，集中重跑全部当前相关 15 项脚本测试。205 商品夹具合并为单次批量插入，未改变商品覆盖或断言。

目标服务器 systemd 255 配置校验通过，calendar 明确下一次为 2026-11-13 01:00:00 JST。第一次生产只回滚试运行扫描389，计划添加159、移除0、不变216、待核实14、禁用0；SQL 后续严格格式校正后，最终 SQL 摘要 `eaaaaf1591bf6be8daa0f6955f1ee8613394731336799eeca25c6c31489bcbce` 重新试运行得到同一结果。没有生产标签写入。安装仅复制四个摘要绑定文件及 daemon-reload，最终首次运行、第二次幂等复查后 enable timer；不更换应用镜像或重启网站。纯新增任务脚本无数据结构迁移，仅增减可恢复的展示标签，采用每次根权限回执中的标签前后数组与版本作局部恢复依据，不创建全库快照或停写。

最终本批正式脚本检查 15/15 通过，55.860 秒，无失败、错误或资源警告，证据 local-acceptance.json。真实隔离测试库已删除，查询 pg_database 返回0。四个安装输入均由 staged.json 绑定 SHA256；Python AST/编译、systemd verify、git diff --check 通过。当前批次候选冻结，可安装；生产最终验收继续单独记录。

## 最终验收矩阵

| 项目 | 结果与证据 |
| --- | --- |
| 删除误建 Codex 任务 | PASS，automation_update 返回 bobuy deleted |
| 服务器实际安装 | PASS，2026-11-12 18:54 JST，安装源码 a67f366142a1f373a36d28cacde9396fade579e1，installed.json 绑定四个安装文件摘要 |
| 每日调度 | PASS，systemd timer enabled/active，OnCalendar 明确 Asia/Tokyo 每日01:00，下一次2026-11-13 01:00 JST；Persistent 启用，服务器错过计划后恢复时补跑 |
| 首次真实同步 | PASS，389 扫描，159添加，0移除，216不变，14待核实，0定义新建；首次根权限回执含每个变更的前后标签及版本 |
| 真实重复执行 | PASS，389扫描，0添加、0移除、375不变、14待核实，服务 Result=success、ExecMainStatus=0 |
| 对外读取 | PASS，公网商品标签接口分24个一批逐个核对全部159个商品，均有唯一且已启用的discount定义及中文“优惠”名称；标记商品列表matchedTotal=159，正常公开商品总数325；后台全量389包含非公开商品，因此两者计数用途不同 |
| 数据与应用边界 | PASS，商品总数389、Flyway仍V34，Core、Frontend、PostgreSQL镜像与安装前一致，服务健康；没有价格、库存、优惠来源、其他标签或前端源码改动，没有网站重启 |
| 失效、未知和并发规则 | PASS，真实PG的12项行为与并发测试、执行器3项测试，详见local-acceptance.json；14个未知商品当前保持原状，不虚构起始日期 |
| 下一次自然定时触发 | 尚未到时，未宣称已观察凌晨触发；本次实际执行来自同一个systemd service的手工启动，调度配置及下次时间已独立核实 |
| 工作区临时清理 | 未完成，自动审批在命令执行前以 blocked by policy 拒绝删除本任务缓存和探测文件；未改工具绕过。未纳入交付提交，仍局限于当前隔离工作区；隔离测试数据库已正常删除 |

最终主目标验收：服务器后台功能、安装、首次同步和幂等通过。自然定时触发留待既定时间，临时文件清理单独记录未完成，不影响服务器任务运行。没有新增Codex自动任务。

公网验收脚本初次使用urllib请求返回403；curl正常请求返回200。按页面相同的24个商品批量读取后，全部159项核实通过。核对当前DTO后将验收字段由total纠正为matchedTotal；这两项只修改验收工具，未修改安装候选或重跑产品测试。

维护入口：`systemctl status bobuy-offer-markers.timer` 查看日程，`systemctl status bobuy-offer-markers.service` 及 `journalctl -u bobuy-offer-markers.service` 查看每次摘要；完整局部变更回执在 `/var/lib/bobuy-offer-markers/run-*.json` 和 `latest.json`，权限0600。停止后续调度使用 `systemctl disable --now bobuy-offer-markers.timer`，不回滚数据库；标签需恢复时逐项核对回执after数组及afterVersion后做局部恢复，禁止覆盖后续编辑。

参考：[systemd timer](https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html) 的时区及 Persistent 行为由目标服务器的 systemd 255 工具验收；[PostgreSQL 行锁](https://www.postgresql.org/docs/current/explicit-locking.html)用于核对事务和管理端互斥边界。
