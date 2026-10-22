# REPORT-16: 宝宝败瀑布流商城验收

日期：2026-10-22。环境：本机 `bobuy-local`，入口 `http://127.0.0.1:18080`。本报告对应最新参考图与小号半透明加购按钮纠正，旧视觉截图不作为通过依据。

2026-10-23 状态纠正：用户指出底部渐变过重、商品被压暗，本报告图片明暗层次的视觉 PASS 已撤销。功能与几何结果保留为历史事实；最新减淡结果须以新运行截图重新验收。

## 范围与版本

- 品牌宝宝败。CSS Grid 瀑布流，手机两列、768px 三列、1440px 六列；桌面自适应窄列，卡片 20px CSS 圆角和完整裁切，横向栅格间距 12px。
- 34px 半透明加购圆面、16px 图标、72% 白色、淡灰细边、12px 背景模糊和轻阴影，外层 44px 热区。商品名称、价格保留白色叠图，底部单层渐隐与文字阴影；品牌移入详情与数量弹窗，避免浅色包装副标题混叠。平板和桌面收起重复底部导航，页头保留购物车与账户入口。
- 初始 6 件，接近底部追加最多 6 件，保留手动加载；已有商品位置稳定。当前为完整 API 目录的客户端渐进展示。数量确认、取消、1 至 99 件、搜索及结账保持。
- 最终构建资源 `index-VythlEuV.css`、`index-C30phMh3.js`；web 镜像 manifest `c81f23f5998083f64ecd111d19af4402ce6650b1d4ad3d8a11fcc5d5249d0c0a`。
- 仅重建现有 Compose 项目 web。其余五服务保持；其他三组项目未操作。未发布生产、未改域名、未改仓库名。

## 功能结果

PASS：瀑布流实现阶段前端全套 24 文件 81 项通过；本次最终修订 ProductFeed 与购物车两文件七项单元测试通过。`npm run build` 通过，脚本语法及 Git 差异空白检查通过。

PASS：品牌副标题移除和宽屏导航修订后，真实栈浏览器六项通过，包含四视口、18 件合成目录三批追加及真实注册/未验证下单/商家认可/测试 SMTP 验证。各视口检查控制台、页面错误、HTTP 失败响应与横向溢出均无异常。搜索清空测试等待商品实际恢复，消除了空列表瞬态量测竞态。

PASS：最终渐隐、细边与阴影修订构建后，四视口浏览器再次全部通过（4 项，24.4 秒）。

PASS：34px 圆面、半透明色、模糊、20px 圆角和裁切均有浏览器 computed-style 断言。注入旧 44px 实心圆面可被新规则拒绝；注入 20px 过小确认按钮可被热区规则拒绝，并恢复到 52px。

后端本轮无修改，后端历史测试事实见 REPORT-15，不宣称本次重新执行。

## 几何结果

PASS：[geometry-check.json](evidence/PLAN59-pinterest-refined/geometry-check.json) 记录 9 状态、180 条控件量测、0 失败。最小实际字形余量 3.00px，最小热区高 44px；居中控件最大 X 偏差 0.95px、Y 偏差 1.08px，逐项满足 min(2px, 字形高 10%)。数量按钮组间距 8px，卡片加购与信息操作区域独立。

[geometry.json](evidence/PLAN59-pinterest-refined/geometry.json) 分别保存圆面背景、内接可用内框、实际 SVG/字体字形边界和热区。34px 圆面与 44px 热区分别测量。双行标题排除裁切外不可见字形；起始对齐标题与搜索不套用居中规则。[budget-negative.json](evidence/PLAN59-pinterest-refined/budget-negative.json) 保存热区正负例。

## 视觉结果

独立来源：本轮 Sub2API 实时模型目录可见 Gemini Pro 与 Flash；Pro 图片请求上游失败，`gemini-3.8-flash-high` 最小图片请求成功识别手机两列。首次复核发现包装品牌副标题混叠，主 Agent 删除卡片品牌小字并保留详情品牌，给半透明圆面增加淡灰细边，收起宽屏重复导航。第二次 Gemini 复核无阻断项，建议微调纸巾名称上缘遮罩与白底按钮轮廓；最终小幅上提渐隐并加深细边与阴影，由主 Agent 检查最终运行截图，不把模型判断或几何通过替代视觉验收。

主 Agent 核对第七件商品落在第四列：该列首排最短，位置符合当前瀑布流规则；有限目录留白不补假商品。对白字对比仅记录截图可读性，未作逐像素 WCAG 认证。

PASS：主 Agent 查看最终版本四视口整体截图及商品、加购默认与悬停、页头、行程、工具栏、数量弹窗原尺寸局部，核对超长名称和最大合成金额状态。卡片四角完整，34px 半透明圆面与照片有可见边界；白色名称和价格层级清晰，纸巾名称区域渐隐已上提，包装副标题混叠已消除。截图来自 Chrome 实际运行环境，视口 360x800、390x844、768x1024、1440x1000。页面采用页头、行程、商品工具栏、瀑布流和导航的纵向层级；同角色加购控件尺寸和卡内偏移一致。底部导航下商品可通过滚动到达。本视觉结论仅覆盖所列浏览器与测试状态，实机限制见下节。

- [手机整体](evidence/PLAN59-pinterest-refined/storefront-390.png)
- [最窄手机](evidence/PLAN59-pinterest-refined/storefront-360.png)
- [平板整体](evidence/PLAN59-pinterest-refined/storefront-768.png)
- [桌面整体](evidence/PLAN59-pinterest-refined/storefront-1440.png)
- [商品原尺寸](evidence/PLAN59-pinterest-refined/card-detail.png)
- [加购原尺寸](evidence/PLAN59-pinterest-refined/plus-detail.png)
- [加购悬停](evidence/PLAN59-pinterest-refined/plus-hover-detail.png)
- [数量弹窗原尺寸](evidence/PLAN59-pinterest-refined/quantity-detail.png)
- [超长标题](evidence/PLAN59-pinterest-refined/synthetic-long-title-360.png)
- [最大合成金额](evidence/PLAN59-pinterest-refined/synthetic-max-price-360.png)

## 限制与剩余

- 图片与七件商品属于本地演示数据，未核验真实库存与图文一致性；18 件目录和超长名称/最大金额为浏览器拦截合成数据，不写入生产数据。真实下单测试只作用于本地测试库和 Mailpit。
- 未完成真实 iOS 设备安全区及触控实机检查；CSS 已使用安全区变量，当前证据为桌面浏览器视口模拟。
- 清理未完成：执行策略拒绝测试输出及旧截图目录删除，保留本地 `frontend/test-results`、旧 `PLAN59-redesign` 与上一轮 `PLAN59-pinterest`，不提交旧截图、不绕过删除限制。最新 `PLAN59-pinterest-refined` 为正式验收交付物。总任务清理门禁保持未完成。
