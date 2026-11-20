# 侧栏与手机展开选中背景验收（2026-11-20）

基线`79d3e4f1f362110bebc5869f9b29c8ab1bd1faf1`，分支`fix/storefront-sidebar-selection-20261120`。本候选包含用户同批追加的手机展开背景修正，尚未冻结时合入。真实子类素材由本机负责：没有生成图案、建立类别图案映射、上传文件或改数据库；统一线框回退来自现有Ant Design AppstoreOutlined。

## 行为与源码

- `StoreNavigation.tsx`：精确根/叶链接是唯一aria-current=page。叶选中时根用data-selected-ancestor淡态和侧线表达所属，不伪装为当前链接。每次打开、深链和所选根数据晚到时只调整Drawer body/aside的scrollTop，使根完整可见；不scrollIntoView、不改document滚动或焦点。每次打开/路由选择只处理一次；用户滚轮、触摸、指针或键盘主动操作取消待执行定位，重渲染不拉回。
- `browse.css`：仅shopping-tree选中换#f4f3f0、#242424深字、细内线和下划线；父所属#faf9f6。保留其他浏览入口样式。根图32px/字15px，子图20px/字14px，图标向右16px，触区最少44px，长名自然换行。鼠标hover与键盘焦点保留。
- `SidebarCategoryIcon.tsx`：复用CategoryImage原有站内公开URL规则、空alt和失败处理；外层aria-hidden。有效子类imageUrl显示operator提供的图片；空/不允许路径/加载失败时统一单色线框，不影响名称或键盘。图标测试覆盖外链拒绝、失败回退、替换恢复。
- `CategoryImageService.java`及`ShoppingTreeProjection.java`：复用原上传API，仅从一级扩到非系统一/二级节点，继续原权限/校验/公开媒体存储；二级imageUrl不再在公开投影中被固定为null。无表/字段/数据迁移，旧应用可忽略已保存子图；回退代码不需改写数据。后台管理页上传按钮仍仅一级，本批不扩后台页面。
- `public-catalog.css`：按用户追加要求，手机展开也用内容内层背景：单行100→78px、两行100→96px；48px图标、100px链接触区、13px文字不变。图标盒上/文字行盒下各4px。compact仍54/72px内容、109px表面/28px图/5入口；保持精细鼠标hover限制、焦点、宽度动画和reduced-motion。桌面顶部样式不变。

## 本机素材绑定契约（本云端未执行写入）

- 在已授权代理或平台管理员会话调用`POST /api/category-tree/{源节点ID}/image`，multipart字段`file`。使用源节点ID，**不是**前台`shop-`展示ID；对应公开facet为`shop-{源节点ID}`。
- 只允许非系统节点、完整路径层级1或2；更深节点/系统归属拒绝，顾客在存储之前拒绝。共享分类树的原锁和actor归属保持。
- PNG/JPEG，非空且≤8MiB；每边1–8192，总像素≤24,000,000；服务端解码再编码，SVG不接受。单色透明PNG建议64或128px方图，20px呈现（建议不是额外API约束）。不改主类彩图。
- 成功返回既有`/api/storefront/recommendation-images/{imageId}`地址并绑定该节点。原公开媒体权限规则不变。数据由本机按授权实施；云端不需生产凭据。
- 只有存在当前可见商品计数的公开类会出现在BrowseFacet；子类必须属于当前二级投影。运营绑定后在真实公开目录读回该facet.imageUrl和实际图片请求，再验侧栏。后台树列表可读回imageUrl；现管理页子类无上传按钮，使用此现有API。

## 实测结果与限制

真实隔离App：既有Spring18080、PG18.6、合成商家1000目录；候选前端5184。360×800、390×844、1280×800均PASS：

- 后排第19根/叶深链，根完整可见；根直接选中、子选中父所属区分，侧栏仅一个aria-current。
- 关闭/重新打开、侧栏选择后重开、从顶部选择第20根后打开均定位正确。开侧栏前后的主页面scrollY一致；真实CDP触摸/桌面wheel手动滚动后不拉回。单测另覆盖数据等待期间已手动探索则取消定位。
- 同时延迟初始化的全部browse响应，先打开空侧栏，再释放响应，后排叶的所属根可见；不把并行请求已到达误当成晚到成功。
- 根行48px，长子类行58px；根/子字号15/14px，子图20px，图标缩进16px，无横向溢出或字形裁切。提供图片时显示图片并隐藏回退；其他缺图项显示装饰性单色轮廓。
- 前端网络夹具只改**实际隔离响应**中第19类的合成长名称和子类imageUrl，使用早已存在的合成图片来测试显示契约。并非后端新上传，也非真实子类素材；后端接入由8项服务单测与原生CI验证。本批没有在运行后端执行真实上传或重启共享服务。
- 单/两行手机展开前后4组对照，100px触区/48px图标/两行完整，背景78/96px，内容盒上下4px。双向过渡逐帧有中间值，compact尺寸与五入口保持；触屏强制:hover无灰底，reduced-motion无中间动画。未改CatalogDock保护逻辑，复用已验后排/横滑功能。
- 无页面/控制台错误、API错误状态。键盘2px焦点可见。M3/M6沿用主Agent视觉降级，已查看手机整图、根/叶原尺寸局部及展开背景对照。Android实机与真实素材效果由本机验收，未声明生产发布。

## 截图与重放

52张PNG：侧栏12组整图/面板/选中区域（36张），展开前后8组整图/原尺寸导航（16张）。

- [390侧栏叶选中整图](leaf-390.png)、[原尺寸局部](leaf-390-selection.png)
- [360根选中](root-360.png)、[父所属与子选中](leaf-360-selection.png)
- [桌面晚到深链](late-1280.png)、[原尺寸局部](late-1280-selection.png)
- [手机展开旧单行](before-expanded-single-390-navigation.png) / [新单行](after-expanded-single-390-navigation.png)
- [旧两行](before-expanded-two-360-navigation.png) / [新两行](after-expanded-two-360-navigation.png)
- `navigation.json`保存三视口每阶段状态、网络和控制台；`before/after-expanded.json`与`top-regression.json`保存尺寸/动画帧。

本机可在候选隔离前端重放（合成目录；不得把这些ID当生产ID）：

- `/products?node=1000&category=shop-000-progressive-19`：打开侧栏检查后排根。
- `/products?node=1000&category=shop-progressive-leaf-19`：打开侧栏检查父所属与唯一当前叶，关闭重开。
- `/products?node=1000`：顶部选择后排类再开侧栏，手动滚动后等待不拉回。

```sh
# frontend：只运行直接单元；图标PASS后未重复
npx vitest run src/components/StoreNavigation.selection.test.tsx src/components/SidebarCategoryIcon.test.tsx
npx vite build --outDir /workspace/scratch/sidebar-built
# 仓库根目录：使用已存在依赖、隔离后端与基线5183；serve为持续进程
JAVA_HOME=/workspace/scratch/jdk MAVEN_OPTS=-Djavax.net.ssl.trustStore=/etc/ssl/certs/java/cacerts /workspace/scratch/apache-maven-3.9.9/bin/mvn -o -s /workspace/scratch/maven-settings.xml -f backend/pom.xml -q -Dtest=CategoryImageServiceTest,ShoppingTreeProjectionTest test
node docs/reports/evidence/storefront-sidebar-20261120/serve.mjs
node docs/reports/evidence/storefront-sidebar-20261120/navigation.mjs
node docs/reports/evidence/storefront-sidebar-20261120/expanded.mjs
VERSION=after node docs/reports/evidence/storefront-sidebar-20261120/expanded.mjs
node docs/reports/evidence/storefront-sidebar-20261120/top-regression.mjs
```

最终前端入口`index-Cix8fjtG.js`。源码、资产和证据SHA见manifest.json。定向前端6项、后端8项PASS；原生CI跟踪PR精确head。首轮测试mock/截图选择器/晚到夹具与桌面hover测量失败及最小续验均在任务文档保留；仅1280续验时复用已通过的两手机结果。保留共享环境和正式证据，不清理他人资源。停在PR待本机独立验收，不自行合并发布。
