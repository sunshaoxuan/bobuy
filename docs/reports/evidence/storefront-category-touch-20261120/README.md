# 分类拖拉触摸反馈验收（2026-11-20）

基线 `1b49f61965f2072d9cdee9ee1ef9663fea798df3`，分支 `fix/storefront-category-touch-feedback-20261120`。产品源码只改public-catalog.css：分类快捷栏链接/箭头、选中、手机compact内层及其透明外框的hover背景均限制到 `(hover:hover) and (pointer:fine)`。不改tap highlight、CategoryShortcuts、CatalogDock、触摸手势、路由或数据。

## 根因与证据边界

本机提供生产Chrome360×800真实复现：展开态饮料选中，从米面干货按住7段横拖后scrollLeft111px、URL和选中不变；放手220ms，米面干货:hover=true、:active=false、背景rgb(240,240,237)。hover/fine能力为false，webkitTapHighlightColor本已透明。该背景精确对应未受媒体限制的`.category-shortcuts-track a:hover`。因此只修hover能力边界，不加复杂手势或修改原生tap。

云端同一真实隔离App、Chromium触摸模拟360/390、展开/compact的自然CDP手势没有稳定复现残留:hover；旧/新自然触摸记录均保留，不声称独立复现了生产触发时序。云端计算tap highlight也是透明、无active反馈。

为确定修复不依赖浏览器是否残留hover，另在真实coarse-pointer上下文以CDP CSS.forcePseudoState保留:hover，分别验普通与选中项：这是明确标记的CSS边界测试，不冒充自然手势。它在旧版复现相同灰底，新版不触发。桌面鼠标则是真实mouse.hover，没有强制伪类。

| hover状态 | 触屏旧版 | 触屏候选 | 精细鼠标候选 |
| --- | --- | --- | --- |
| 展开普通项背景 | #f0f0ed | 透明 | #f0f0ed |
| 展开选中项背景 | #e5e5df | 基础选中#eeeee9 | #e5e5df |
| 手机compact普通内层 | #f7f6f3 | 透明 | #f7f6f3 |
| 手机compact选中内层 | #eeede8 | 基础选中#f4f3f0 | #eeede8 |

## 直接验收

- 自然触摸before/after各4场景：360×800、390×844的展开和compact。记录initial、touchStart保持100ms、5px小移、45/90px横拖、放手350ms、正常轻点。候选未选中项在所有触摸阶段外/内背景均透明；拖动URL不变、click0、history.pushState0，横向滚动实际发生；轻点click1、pushState1、仅一个aria-current且为目标类。无点击穿透证据，因此未增加阻止点击逻辑。
- capability.json共12场景：两手机/两状态/旧新强制hover8项，真实鼠标1280×800及390×844/两状态4项；全部PASS。手机即使hover为true也无未选中背景，选中基础样式保持。键盘focus-visible=true、2px solid，原焦点样式保留。
- 所有自然触摸运行无控制台/页面错误，API状态无>=400；能力检查无控制台/页面错误。服务端使用既有Spring18080与PG合成目录，无写入。标签“饮料”“米面干货”只临时DOM替换，真实URL/接口/React路由仍是现有合成商品分类，不冒充生产数据。
- 既有五入口、6px间距、109px栏高、54/72px内层、文字与图标、宽度动画/reduced-motion/晚序保护没有相关源码变化，复用PR171/170已成立证据，不重复布局或全套手势测试。此次不声明Android实机验收；本机协调发布后复测。

## 截图与原始记录

共49组整图/原尺寸导航局部（98张PNG），主Agent已查看旧新强制hover差异及触摸图，按既定M3/M6主Agent视觉降级。

- 明确标记强制hover的旧新对照： [360展开旧局部](before-touch-360-expanded-hover-navigation.png) / [新局部](after-touch-360-expanded-hover-navigation.png)，[旧整图](before-touch-360-expanded-hover.png) / [新整图](after-touch-360-expanded-hover.png)
- [360收拢旧局部](before-touch-360-compact-hover-navigation.png) / [新局部](after-touch-360-compact-hover-navigation.png)
- 自然拖动：[390收拢中整图](after-compact-390-drag.png) / [局部](after-compact-390-drag-navigation.png)，[放手整图](after-compact-390-released.png) / [局部](after-compact-390-released-navigation.png)
- [桌面真实鼠标hover](after-mouse-1280-expanded-hover.png)，[桌面键盘焦点](after-mouse-1280-focus.png)，[触屏键盘焦点](after-touch-390-focus.png)
- `before.json`、`after.json`记录触摸阶段、CSS状态、点击/导航计数、网络和控制台；`capability.json`明确区分CSS强制hover和真实鼠标方法。

## 命令与产物

```sh
# frontend目录：仅构建本次受影响前端
npx vite build --outDir /workspace/scratch/category-touch-built
# 仓库根目录，serve为持续服务
node docs/reports/evidence/storefront-category-touch-20261120/serve.mjs
node docs/reports/evidence/storefront-category-touch-20261120/touch.mjs
VERSION=after node docs/reports/evidence/storefront-category-touch-20261120/touch.mjs
node docs/reports/evidence/storefront-category-touch-20261120/capability.mjs
```

依赖既有隔离18080后端/合成数据及5182旧静态产物，候选5183，不对生产执行。旧入口index-BqwjGagB.js，新入口index-CUKHSFty.js，构建一次PASS；实际CSS/资产/证据摘要见manifest.json。未跑无关本地测试/后端构建，原生CI状态及确切head记录在PR。保留共享环境、脚本和正式证据供本机复核；云端不合并、不上线。
