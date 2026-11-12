# 国家地区分级档案交付记录

本地开发验收通过。本批按用户最终要求，只建立基础档案、查询选择接口和基础资料查看入口。分支为 `codex/geographic-master-20261112`，基线为 `79b0f5f`。生产发布、远端推送及个人资料/结账/订单接入均未执行。

## 功能与数据

| 层级 | 预制范围 | 数量 |
| --- | --- | --- |
| 国家/地区 | ISO 3166-1 alpha-2 代码，四语界面显示本地化国家名 | 249 |
| 省县 | 日本都道府县 | 47 |
| 市/区 | 日本市区町村，包含20个政令指定都市本级及其行政区 | 1912 |

入口为 `/admin/basic-data/geographic-areas`，归属现有“基础档案”菜单。默认日本，支持按代码、名称、日文读音搜索和三级联动选择，切换上级立即清空下级。非日本国家仅显示国家级档案说明。无新增档案写入接口，后续参考数据维护使用新版本迁移。

日本第三级以J-LIS五位地域代码为唯一标识；政令市的区保留所属市名称，例如札幌市中央区，町村保留郡名前缀。市本级与行政区均直接归属都道府县，保持用户要求的三个层级。

## 选择接口

`GET /api/storefront/geographic-areas` 为公开参考数据读取；`GET /api/merchant/geographic-areas` 沿用AGENT角色边界。TypeScript入口为 `masterDataApi.geographicAreas(parentCode?)`。

| 查询 | 返回 |
| --- | --- |
| 省略parentCode | 国家/地区根节点 |
| parentCode=JP | 日本47都道府县 |
| parentCode=JP-13 | 东京都市区町村 |
| 已存在的叶节点或其他国家 | 200，空数组 |
| 不合格式的代码 | 400 |
| 不存在的父级 | 404 |

响应沿用 `ApiResponse`，data数组项包含 `code`、`parentCode`、`level`、`name`、`reading`。日本省县代码形如 `JP-13`，第三级形如 `JP-13101`。代码前导零保留。已认证写方法明确405，无业务数据写入。

## 来源与迁移

国家来源为[pycountry官方ISO数据](https://github.com/pycountry/pycountry/blob/main/src/pycountry/databases/iso3166-1.json)。日本以[J-LIS地方公共团体代码名录](https://www.j-lis.go.jp/spd/code-address/jititai-code.html)47页为基础，并逐代码核对[日本邮政UTF-8数据](https://www.post.japanpost.jp/service/search/zipcode/download/utf-zip.html)2026-10-30版。读取日期为2026-11-12。正式证据目录保存最小数据摘录、来源URL和原始响应SHA256，不包含机关电话、业务或账户资料。

V34只新增 `bb_geographic_area`。复合外键强制父级层级，CHECK约束限制代码、国家/省县前缀、空名称与根节点。SQL生成器从固定摘录重建，重复应用幂等。现有地址和业务表均不修改。旧应用可以继续使用原有表，应用回滚可保留新参考表；生产发布仍须现行备份、迁移和CI/CodeQL门禁。

## 验收矩阵

| 项目 | 结论 | 证据与边界 |
| --- | --- | --- |
| 数据完整性与父子约束 | PASS | migration.json：2208条逐字段匹配来源，覆盖邮政全部1892代码，47省县均有子级，其他国家无下级 |
| PostgreSQL迁移与恢复演练 | PASS | 现有本地PG18.6内独立克隆库，7类错误关系拒绝，重复执行幂等，31张原表内容不变；删除新表/重建演练后临时库已删除 |
| 后端正式verify与配置覆盖率 | PASS | 674报告、650执行、24条件跳过，0失败；BobbuyStore行94.53125%、分支77.77778%，阈值保持90%和70% |
| 前端共用检查与最终受影响复测 | PASS | 共用120文件814项通过；最终档案/币种入口2文件6项通过。轻微UI修正后仅复测受影响输入，详见主任务记录和validation.json |
| i18n/TypeScript/生产构建 | PASS | 最终构建通过，1693资源键校验通过；既有循环chunk警告不影响本批构建 |
| 真实浏览器功能与响应式 | PASS | browser.json：12状态，1440×1000及360×1000视口；三级选择、清理下级、叶级空数据、分页、重载/刷新和四语均通过 |
| 控制台与网络 | PASS | 0 JavaScript/Console错误，0失败请求；实际加载资源SHA256绑定validation.json |
| 几何 | PASS | pixels.json：94个可见控件实际截图字形边界测量，最小字形余量11px，最大垂直偏差1.109375px，分页热区至少44×44px、间隔8px且同排 |
| 主Agent最终视觉 | PASS | 已查看最终整体、原生视口及原尺寸控件局部，导航/四边完整、信息层级清晰、长名称与分页无裁切或换行；控件预算保持原值 |
| Gemini独立建议 | 已复核 | gemini-3.8-flash-high图片输入实测可用；最终建议确认整体构图、无裁切及紧凑分页。触区疑点由实际尺寸消除；禁用占位低对比疑点已用局部颜色修正和最终截图复核。该建议独立保留，不替代主Agent验收 |
| 生产与消费者地址接入 | 未执行 | 按用户收窄范围，本次为基础档案开发交付，不宣称线上可用 |

最终截图数据为真实公开地域参考数据，商家身份为仅本地可用的合成测试身份。`*-whole.png`是完整页面，`*-viewport.png`是1000px高实际视口，`*-selectors.png`是原尺寸局部。早期滚动全图和分页换行结论均已失效，最终图经过回到顶部重新采集。英文最长国家标签经249个条目实际字体宽度比较，为South Georgia & South Sandwich Islands (GS)；日本最长邮政市区町村名称为南都留郡富士河口湖町。

主目标、方法、兼容纠正与验证过程见[任务指导文档](../plans/GEOGRAPHIC-MASTER-20261112.md)。机器回执位于 `evidence/geographic-master-20261112/validation.json`。仅本批可复用失败经验作为codex-selfimp候选保存，未安装或改写全局规则。
