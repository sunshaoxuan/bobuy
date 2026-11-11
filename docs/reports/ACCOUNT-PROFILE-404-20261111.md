# 登录后本人资料 404 修复

## 目标与范围

用户在生产登录后进入“我的账户”，本人资料区域显示 Resource not found。用户已授权修复并上线。本批定位实际请求、路由与服务版本，修复根因，验证客户和采购员登录后的资料读取、无改动保存与重读，并发布受影响服务。保护登录身份、资料权限、既有业务数据和其他服务；不纳入原工作区无关改动。

沿用已完成商品卡片发布的独立干净工作树，新分支 codex/account-profile-404-20261111，基线 8dfe56f。生产先前 Core b8b7158、前端 8bfb479 仅作为定位线索，执行前核对当前状态。

## 方法与完成标准

先核前端请求和服务归属，再核生产路由、运行映射和实际响应。用隔离本地合成账户复现并修复，覆盖正确本人读取/保存、未登录和越权拒绝，防止以假资料或错误身份掩盖 404。冻结候选后统一运行受影响的项目强制门禁，绑定源码、依赖、JAR/前端和镜像摘要。按现有发布守卫更新必要服务，不覆盖生产客户资料，不恢复旧数据库快照。

完成标准：真实生产本人资料请求可由当前登录身份正确处理，桌面和手机界面不再出现该错误，登录、资料保存重读及权限边界有有效证据；发布后核对实际版本、健康、控制台、网络和截图。缺失项保持未完成。生产不创建客户订单或修改真实用户资料作为测试。

## 当前状态

2026-11-11 14:08 UTC 生产实际 Nacos gateway-service.yaml 与仓库一致，auth-route 将 /api/auth/** 转发至旧 Auth 20261028.3。当前 Core 20261111.4 的 common JAR 含 SelfProfileController。用户现有浏览器会话：刷新令牌 200，me 200，profile 404，页面重现 Resource not found。根因是接口所属服务与广域路由冲突。

本批仅在 Nacos 网关配置中，于 auth-route 前加入精确 /api/auth/profile 到 Core 的路由。Auth 登录、刷新和 me 保持原归属；资料 GET/PATCH 均经过 Core 原有认证和本人字段白名单。无 UI、Java 业务或数据库修改，无新镜像需求。用 Spring 实际 Path 谓词和生产 YAML 绑定验证路由及删除精确路由的负例，再验证本地合成客户/采购员资料读写与权限，发布单个 Nacos 配置并验证真实登录页面。仅配置发布无需停止业务写入或恢复数据库；回滚为原配置内容。

## 冻结前检查

Gateway 模块正式 test：5 项通过，0 失败、0 错误、0 跳过，包含全部既有测试和生产配置路由回归。使用 Spring YAML Binder 与 PathRoutePredicateFactory，验证 GET/PATCH profile 到 Core，登录/刷新/me 仍到 Auth，AI/IM/商品路由保持归属；移除精确路由会复现 profile 到 Auth 的错误目的地。

隔离本地 Core 合成 customer 与 agent 均完成真实登录、本人 GET、空补丁无改动保存和重读；id/roles/emailVerified 字段注入均被 400 拒绝，资料不变；匿名 GET/PATCH 均 401。记录见 evidence/account-profile-404-20261111/local.json。未修改业务 Java、前端、依赖或迁移，沿用前批已绑定的相同 Core JAR 和前端产物；本批新增配置由本次 Gateway 全模块测试覆盖，无须重建无改动产物。

发布脚本仅更新指定 gateway-service.yaml 的 Nacos 内容及服务器正式配置文件。应用前比对旧配置、源码哈希、所有 Bobuy 容器身份/镜像/重启数与受保护节点状态；保存原配置支持精确回退。应用后读取 Nacos 验证内容与所有服务未替换。生产浏览器仅读取真实本人资料，保存和权限负例仅在本地合成环境执行。原报告未覆盖生产认证资料页，本例使该路径的生产可用性判定失效；由本批真实复验补齐。

## 最终发布与验收

修复提交 `400773a142de7a5f3d692fae7f9c4d694ef17eb9` 已推主分支。该精确提交的 [CodeQL 三项检查](https://github.com/sunshaoxuan/bobuy/actions/runs/43036479285) 全部成功。2026-11-11 14:17:30 UTC，即日本时间 23:17:30，配置发布到生产 Nacos 与正式配置文件；无需重启容器、替换镜像或修改数据库。生产配置 SHA256 `a5a7bc6a3a796cc4b3ee261287a08a877a680934d53fe85a0a240ea385d3f9c5`。14:20:08 UTC 独立复核内容相同，所有 Bobuy 容器身份、镜像与重启数和受保护节点状态与发布前一致，网关业务健康接口 200。

| 必需项 | 结果 | 证据 |
|---|---|---|
| 生产错误复现与根因 | PASS | 旧 Nacos 广域 Auth 路由，现有会话 refresh/me 200、profile 404，旧 Auth 缺少接口 |
| 路由与现有边界回归 | PASS | Gateway 5 项正式测试，含真实 Spring Path 谓词负例，gateway-tests.json |
| 客户与采购员读取、保存、重读 | PASS | 本地合成账户真实 HTTP 检查，local.json |
| 匿名与字段越权拒绝 | PASS | GET/PATCH 401；id/roles/emailVerified 补丁 400；资料保持原值 |
| 精确源码 CI | PASS | ci.json，CodeQL Java、前端、Actions 三项成功 |
| 实际配置发布与回退材料 | PASS | binding.json、apply.json、verify.json；服务器原配置与 operator 留存在 /opt/bobuy/releases/20261111.profile-route |
| 当前生产本人资料请求 | PASS | 用户现有会话 profile/me 均 200，browser.json；生产本人资料未作写入测试 |
| 整页刷新与离开后重进 | PASS | 表单均重新加载，无 Resource not found |
| 桌面 1440×900 | PASS | production-desktop.jpg；姓名、邮箱、可选资料与保存按钮正常，无横向溢出 |
| 手机 390×844、360×800 | PASS | production-phone.jpg、production-narrow.jpg；表单和导航正常，无横向溢出 |
| 控制台与网络 | PASS | 本站应用错误 0；两条自动填充扩展错误与三条主题扩展警告均有 chrome-extension 来源，console.json；资料请求 200 |
| 数据与服务保护 | PASS | 无生产资料修改、迁移、容器或镜像变更；原服务与受保护节点身份保持一致 |

截图来自真实生产现有账户。profile-restored.png 是 production-phone.jpg 的原尺寸无缩放局部裁图，用于展示原报错区域已恢复。前端外观、布局与控件均未修改，本批验收聚焦现有表单恢复及响应式可用性，不宣称重新验收全站其他 UI。截图 API 的 clip 调用发生浏览器连接异常，随即改用已成功的完整原尺寸截图并作离线无缩放裁切；临时视口覆盖已 reset。验收过程中未改变浏览器扩展设置，也未将账户截图发送外部模型。

本批目标完成，总体验收 PASS。最终证据补交只包含报告与验收产物，不改变上述已冻结、已通过 CI 且已发布的配置字节。

本地收尾限制：自动审批在执行前拒绝了包含清理临时目录的组合命令，理由仅为 blocked by policy，未提供更细分类。未执行删除，也未换用其他方式重试删除。任务私有 .task-tmp/account-profile-404、Gateway target 和证据目录 __pycache__ 因而仍在本地保留；不包含生产数据或生产凭据，不影响本次生产修复。验收记录改为独立提交，排除这些过程产物。
