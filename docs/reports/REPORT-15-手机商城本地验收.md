# REPORT-15: 手机商城本地验收

日期：2026-10-22；范围：PLAN-59 / PROD-05；环境：唯一 Compose 项目 `bobuy-local`。
本轮修改未部署到生产。正式用户、库存、支付与外部邮件均未作为测试数据。

## 1. 交付与判定

| 项目 | 结果与证据 |
| --- | --- |
| 公开首页 | PASS：未登录可查看公开行程、商品、详情与搜索；非公开字段由公开 DTO 排除 |
| 临时购物车 | PASS：浏览器持久保存、刷新恢复、数量增减/删除、结账前保留购物意图 |
| 注册与订单 | PASS：用户名/密码/邮箱注册，未验证客户可提交 NEW / UNPAID 待确认订单；价格取服务端，UUID 幂等 |
| 邮箱 | PASS：同组 Mailpit 实际收到 SMTP 邮件，浏览器输入验证码后验证成功；过期、单次使用、五次错误上限有集成测试 |
| 商客认可 | PASS：A 认可不会验证邮箱或激活 B；B 无自己订单时拒绝认可，有自己订单后需单独认可 |
| 维护入口 | PASS：/admin 商家登录及手机菜单；客户进入维护入口被转回商城 |
| 多商家边界 | PASS：商品、行程、订单、历史流水、私聊相关隔离负例；客户内部行程只列其订单关联行程 |
| 本地容器 | PASS：web/backend/PostgreSQL/Redis/RabbitMQ/Mailpit 六服务，同项目网络及命名卷 |
| 数据迁移 | PASS：真实 PostgreSQL 空库 V1 至 V4 成功，后端重建后 schema 仍为 V4，无重复迁移 |
| 本轮生产发布 | 未执行：远程节点、Cloudflare、域名、仓库名保持本轮操作前状态 |

## 2. 检查记录

- `mvn -f backend/pom.xml package`：181 项，0 失败、0 错误、2 跳过。跳过项为 `AiVisionIntegrationManualTest` 两项人工 AI 测试。JaCoCo 未产生执行数据，不宣称覆盖率。
- `npm test -- --run`：23 文件、77 项通过，包含购物车约束与现有前端回归。
- `npm run build`：TypeScript 与 Vite 构建通过。现有 vendor 约 1.37 MB，未在本轮扩大为打包重构。
- `BOBUY_LOCAL_E2E=1`、`BOBUY_BROWSER_PATH` 指向本机 Chrome，运行 `npx playwright test --config playwright.storefront.config.ts`：最终 5 场景全部通过。
- 四视口：360x800、390x844、768x1024、1440x1000。检查商品实际图片加载、空搜索结果、详情开关与加购、刷新购物车、结账表单、横向溢出及末项操作可达性；这些场景的 pageerror、console error、HTTP >=400 收集为空。
- 第五场景使用真实 API、数据库和 SMTP：注册、未验证下单、客户不能进入维护页、所属商家认可、邮箱验证码激活。邮件在本地收件箱截获，未向外部邮箱投递。
- 手工补充：360px 下 7 种商品各 99 件、合计 JPY582,120，全部加号禁用，金额和确认按钮完整可见。商家客户页面连续刷新三次保持会话，相关网络未见 >=400 响应。
- `docker compose -p bobuy-local -f compose.local.yml config --quiet` 与 `git diff --check` 通过。

## 3. 功能、几何与视觉

功能结果：上述五个浏览器场景通过。几何结果与视觉结果分别记录，截图用于独立复核。

- 新商城手机双列、平板三列、桌面四列；桌面正文最大 1160px，1440px 视口正文内侧左右各 160px，栅格对称。
- 控件背景边界、扣除边框后的可用内框、实际字形边界、图标边界与热区记录于 [geometry.json](evidence/PLAN59/geometry.json)。文字使用最终字体 Canvas actualBoundingBox 与 Range 基线；图标使用 SVG path 的屏幕变换边界。通知数量角标属于独立状态附着物，单独于居中标签量测。
- 103 次核心按钮、注册/登录切换、导航及商家客户操作量测均满足对应预算：热区高最小 44px，已测字形/图标四边余量最小 6.83px，中心偏差最大横向 1.22px、纵向 1.07px；文字逐项使用 min(2px, 字形高 10%)，纯图标使用 2px 光学容差。
- 数量控件示例：数字两侧间距各 22px，同排按钮中心差 0px；首页加入按钮到浮动结算条的末屏可达间距超过 6px。页头两操作间距手机 6px，底部导航间距 8px。
- 负例：临时注入 20px 高按钮被量测拒绝，恢复后为 44px。标题旧换行出现 7+1 个字符，修复后为 4+4；浏览器测试加入孤字断言。
- 主 Agent 查看完整页面及原尺寸局部：外框和四角完整，图片正确加载，同角色按钮、标题层级、购物车与表单操作归属清晰，最窄屏金额与按钮无裁切。全页长图中的 fixed 导航停留在初始视口位置；真实滚动到底的截图单独证明操作区可达。

独立 Gemini 复核：模型目录实时查询；Pro 图片最小请求两次上游失败，已验证图片输入的 `gemini-3.8-flash-high` 完成复核。模型提出标题孤字，原尺寸截图证实并修复；同时提出热区和居中需实测，结果见上。其“桌面搜索框超过 1000px”的描述与实际 480px 不符，主 Agent 未采纳；详情按钮贴底属于可选交互建议，本轮保持紧随内容的可滚动布局。最终修复截图由主 Agent 复核，未把模型条件通过当成自动放行。

视觉结果：本轮核心页面复核通过，证据为最终本地版本。此判定不覆盖未修改的全部历史采购与财务页面。

## 4. 截图

均为本地演示商品与测试账户，真实 Chrome 渲染；最终前端 CSS 产物 `index-BOC_7Rtb.css`。

- [390px 整体视口](evidence/PLAN59/mobile-overview-390.png)、[原尺寸商品操作局部](evidence/PLAN59/mobile-product-controls.png)。
- [360px 完整首页](evidence/PLAN59/storefront-360.png)、[390px](evidence/PLAN59/storefront-390.png)、[768px](evidence/PLAN59/storefront-768.png)、[1440px](evidence/PLAN59/storefront-1440.png)。
- [360px 底部商品与浮动条](evidence/PLAN59/catalog-bottom-360.png)、[详情抽屉](evidence/PLAN59/detail-390.png)、[最大数量购物车](evidence/PLAN59/cart-max-360.png)。
- [注册结账全页](evidence/PLAN59/checkout-390.png)、[结账底部真实视口](evidence/PLAN59/checkout-bottom-390.png)、[订单提交](evidence/PLAN59/order-success.png)。
- [商家客户认可](evidence/PLAN59/merchant-customers.png)、[邮箱已验证](evidence/PLAN59/verified-account.png)。

## 5. 本地入口与剩余边界

客户 `http://127.0.0.1:18080`；商家 `http://127.0.0.1:18080/admin`；测试收件箱 `http://127.0.0.1:18025`。
演示商家 `agent / agent-pass`。入口均绑定回环地址，容器组保留运行供核对。
启动/状态/停止使用 `scripts/local-test.ps1 start|status|stop`。本轮所有 Compose 管理命令固定指向 bobuy-local；现有 local-game-test、meelok-local、nexora-local 项目仍在运行，未对它们执行启动、停止、重建或清理。

公共生产发布仍需正式 SMTP、注册及邮件 IP/邮箱配额、账户恢复、生产商品审核和备份恢复门禁。商家自助注册、独立平台管理员跨商家授权入口未实现。旧全局合伙人钱包与全局账户写入对商家关闭，恢复须另做租户化验收。V4 在歧义历史商家映射或小写用户名/邮箱冲突时主动失败；实际有数据生产升级与回滚尚未演练，本轮仅验证空库及重启。

已保留失败及修复原因：Dockerfile-local ignore、实际 Origin CORS、body 固定高度、异步目录加载的测试等待、窄屏孤字。一次性浏览器输出清理前，最终截图已转入本报告证据目录。既有早于本轮的任务文件保留。

过程清理未完成：执行策略拒绝 `Remove-Item`，`frontend/test-results` 仍在本地且不提交。证据目录中的 `cart-bar-detail.png`、`checkout-mobile.png`、`mobile-390.png`、`mobile-cart-bar.png`、`product-mobile-detail.png` 保留为早期对比材料，不参与最终视觉判定。首次 RabbitMQ 测试卷 cookie 所属用户错误已仅在 bobuy-local 卷内修复，其他卷未操作。此清理剩余项单独记为未完成，不改变已执行测试的实际结果。
