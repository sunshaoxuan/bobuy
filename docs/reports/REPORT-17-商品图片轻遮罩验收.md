# REPORT-17: 商品图片轻遮罩验收

日期：2026-10-23。目标：降低商品图片底部黑渐变，保持白字可辨和图片通透。环境：唯一 `bobuy-local`，`http://127.0.0.1:18080`，Chrome 视口模拟，本地七件演示商品。

## 实现与版本

- 遮罩从覆盖整图、末端 84%，改为仅底部最多 96px、末端 18%，中间节点为 40% 高度处黑色 4%、72% 处黑色 10%。图片主体无额外滤镜。
- 白色名称增加 0.5px、黑色约 67% 的细边，先描边后填充；名称和价格使用单层短阴影。取消双层大范围黑晕。
- 名称透明点击区向左增加 1px，文字位置与排版宽度保持；字形量测计入描边。20px 圆角、瀑布流列数、34px 半透明加购圆面和 44px 热区保持。
- 最终资源 `index-d_rkqh5x.css`、`index-jJzS37oC.js`；web 镜像 manifest `553d019f942cff6fc255ad4f583de441157f4e5b1ec3ff5fcd05b78e7621fa2a`。仅重建本组 web，其他五个服务保持运行，未创建环境，未操作远程节点。

## 功能与几何

PASS：ProductFeed 单元测试 4 项通过。最终 `npm run build`、视觉脚本语法检查通过。最终四视口浏览器 4 项通过（17.8 秒），覆盖 360x800、390x844、768x1024、1440x1000，包含搜索、滚动追加、数量取消及上限、详情加购、购物车刷新、结账注册引导。控制台错误、页面错误、HTTP 失败响应和横向溢出检查通过。后端、注册邮件和商家权限本轮无变动，未重新执行全套业务测试。

PASS：新轻遮罩高度、透明度、白字及细边由浏览器 computed-style 断言；注入旧整图 84% 重遮罩会被拒绝，移除后正例再次通过。

PASS：[geometry-check.json](evidence/PLAN59-light-scrim/geometry-check.json) 记录 9 状态、180 条控件记录、0 失败。最小字形余量 3.75px、最小热区高 44px，居中控件最大 X 偏差 0.95px、Y 偏差 1.08px，满足原预算。背景、内框、实际字体/SVG 字形及热区分别记录于 [geometry.json](evidence/PLAN59-light-scrim/geometry.json)。新描边曾使牛奶名称左余量降至 2.825px，扩大透明点击区后修复，未放宽阈值。

## 视觉复核

失效结果：旧 REPORT-16 图片明暗视觉 PASS 撤销。首次 46%/128px 仍有浅色包装灰雾及双层文字重影；第二次 28%/104px 的白字边缘偏虚，均未作为最终证据。

独立来源：实时模型目录查询后 Gemini Pro 图片请求上游失败；`gemini-3.8-flash-high` 最小图片请求成功。三轮实际截图复核中，第三轮确认 18%/96px 无大面积压暗、主要文字可辨，指出纸巾复杂笔画仍稍弱。主 Agent 将名称细边从 0.35px 微调至 0.5px，并独立查看最终版本，模型意见不替代验收。

PASS（本轮明暗范围）：主 Agent 查看最终四视口整体、深色食品和浅色纸巾/牛奶原尺寸局部，以及最长名称和最大合成金额状态。商品高光与包装细节明亮，文字周围没有大面积黑晕；名称和价格可读，圆角及加购外观保持。纸巾中文仍与包装英文共处同一区域，最终细边使中文字形边缘可辨，此结论不等同纯色底对比或 WCAG 认证。实际未知商品图片仍须发布前逐图检查。

- [390px 手机整体](evidence/PLAN59-light-scrim/storefront-390.png)
- [360px 手机整体](evidence/PLAN59-light-scrim/storefront-360.png)
- [768px 平板](evidence/PLAN59-light-scrim/storefront-768.png)
- [1440px 桌面](evidence/PLAN59-light-scrim/storefront-1440.png)
- [纸巾原尺寸局部](evidence/PLAN59-light-scrim/light-package-detail.png)
- [牛奶原尺寸局部](evidence/PLAN59-light-scrim/milk-detail.png)
- [食品原尺寸局部](evidence/PLAN59-light-scrim/card-detail.png)
- [最长标题](evidence/PLAN59-light-scrim/synthetic-long-title-360.png)
- [最大金额](evidence/PLAN59-light-scrim/synthetic-max-price-360.png)

## 未完成与边界

iOS 实机验证未完成，截图属于 Chrome 模拟；超长名称与最大金额为拦截合成数据，不写业务库。本轮无生产发布。旧截图和测试输出删除曾被执行策略拒绝，保持未提交且不绕过限制；清理门禁未完成，历史目录不作为本轮验收证据。
