# 前台导航清理实施记录

## 授权范围与本批修改

- 仅调整顾客端导航、相关四语名称、隐藏路由的顾客行为、公开 SEO 清单与 UI/UX 标准；不删除行程或优惠邮报路由、页面及后台推荐管理。
- `VITE_STOREFRONT_TRIPS_ENABLED=false`（未配置亦为 `false`）：隐藏可预订/已执行行程入口，直接 URL 保留节点参数并重定向到 `/products`。
- `VITE_STOREFRONT_DEALS_BULLETIN_ENABLED=false`（未配置亦为 `false`）：隐藏优惠邮报入口；路由及后台工作流保留。
- 「本程好物」改为「好物推荐」（en-US `Product Picks`；ja-JP `おすすめ商品`）；原期次「好物推荐」改为「优惠邮报」（en-US `Deals Bulletin`；ja-JP `お買い得便り`）。
- 桌面和移动端默认均收起，分别使用 `bobbuy_store_navigation_desktop` / `bobbuy_store_navigation_mobile` 记忆。桌面默认收起是为了让以图片为主的目录从首次访问起使用全宽；展开使用覆盖层，避免推动内容和布局跳动。

## 最小验证集合

- 导航组件测试：四语下仅显示允许入口，隐藏行程、优惠邮报和重复账户项，并核对更名。
- 路由测试：隐藏行程直接 URL 重定向至商品目录并保留节点范围。
- 偏好测试：移动/桌面默认收起、设备分桶及记忆相互独立。
- i18n 静态检查与 TypeScript 检查：覆盖四语键和组件类型。
- UI 验收依 `docs/ui-ux-guidelines.md` §8 / §9：390×844 与 1280×800 截图，并核对菜单按钮的计算宽高、最小宽高、圆角、边框、背景和阴影。

## 浏览器验收环境说明

- 本地 Vite 页面可启动，但容器未安装 Chromium；`npx playwright install chromium` 被下载端点以 HTTP 403 拒绝。因此本次无法生成 §9 要求的两张实拍或读取浏览器计算样式，交付时明确保留为环境限制，不以静态声明冒充计算结果。
