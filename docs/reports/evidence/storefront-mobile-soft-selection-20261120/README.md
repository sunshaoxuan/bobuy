# 手机吸顶选中内层验收（2026-11-20）

基线 `700b60060d084255c3b09951079124a13af95bbf`，分支 `fix/storefront-mobile-soft-selection-20261120`。用户要求解决“全部”整块72px选中背景下部空白、硬边问题；仅手机compact调整视觉内层，未改数据、过滤、分类URL、CatalogDock逻辑或发布生产。

## 实现与实测

CategoryShortcuts增加没有role/aria/tabIndex的内容span；aria-current、链接、图标class和标签span[title]保留。非手机compact为display:contents，保持原布局。手机compact仍是72px链接，背景仅画在内容span上：#f4f3f0、16px圆角、1px轻内侧线#e5e3dc，深字#242424与下划线保留。图标盒上/文字行盒下各4px，图文gap为0（实际文字字形仍有行内留白），所有分类同样排布；一行背景54px，两行72px，未增加栏高。普通hover内层#f7f6f3，选中hover#eeede8；外触区透明，可见2px键盘焦点环保留。

同一真实隔离App：旧产物5181、新产物5182，Spring18080与既有PostgreSQL18.6/合成商家1000目录，DPR1 Chromium。没有数据库写入。360×800、390×844的全部、一行“饮料”、两行“面包谷物与抹酱”及键盘焦点均有前后整图/原尺寸局部；1280×800展开/收拢直接隔离。

| 项目 | 360px | 390px |
| --- | --- | --- |
| 全部/单行视觉背景高 | 72→54px | 72→54px |
| 两行背景高 | 72px | 72px |
| 原尺寸文字含下划线墨迹到底框（单行） | 22→4px | 22→4px |
| 图标盒顶部 / 行盒底部留白 | 4px / 4px | 4px / 4px |
| 可见图案到背景顶（含图案自带内留白） | 8px | 8px |
| 触区宽×高 | 59.1875×72px | 60×72px |
| 起点完整入口 / gap | 5 / 6px | 5 / 6px |
| 表面高 / 图标 / 字号行高 | 109 / 28 / 13与18px | 相同 |

原尺寸像素分析见ink.py/ink.json：不把行盒空白误作墨迹。当前“全部”SVG及合成类图案自身含4px内空白，故可见图案顶余量8px；没有为凑数裁剪或缩放图像。底部含下划线余量4px，字形无裁切、两行36px且scrollHeight=clientHeight。文字对背景对比度13.99:1。两行标签分别为“面包谷物”/“与抹酱”。真实类名形态由临时浏览器DOM替换，服务端仍是合成目录，不代表生产类目数据。

手机展开、1280桌面展开/收拢的链接/图标/文字/轨道/表面几何与原样式完全一致。64张PNG共32组整图及原尺寸局部，主Agent查看旧版、新版全部、两行、焦点和整页；M3/M6使用既定主Agent视觉降级。

## 直接交互检查

- motion.json：360/390双向宽度/gap连续过渡、快速反转、晚序第19类直接URL选中保护、从商品/分类栏触摸上滑、动画中主动横滑接管、隐藏项不拉回、浏览器返回纵横位置、reduced-motion关闭过渡全部PASS。复用原脚本只改候选端口，未改业务数据。
- 新包装没有改变CatalogDock追踪对象（链接父元素仍li），无需重跑未变逻辑的本地单元集合。现有组件/功能单测由原生PR CI承担。
- hover.json：选中/普通hover仅内层改变颜色，外触区透明，72px高度不变。focus整图可见原2px焦点环；灰底、下划线和aria-current仍表达选中。
- visual与motion均无控制台/页面错误、API错误状态，无页面横向溢出。既有渐进加载、价格/分类功能、四语文本/业务语义按未改输入复用；本次视觉指定简中，未声称真实Android设备验收。发布后手机实机验收由本机协调。

## 查看证据

- 390全部：[旧整图](before-all-390.png) / [新整图](after-all-390.png)，[旧局部](before-all-390-navigation.png) / [新局部](after-all-390-navigation.png)
- 360全部：[旧局部](before-all-360-navigation.png) / [新局部](after-all-360-navigation.png)
- 两行：[360整图](after-two-360.png) / [原尺寸局部](after-two-360-navigation.png)，[390整图](after-two-390.png) / [原尺寸局部](after-two-390-navigation.png)
- 焦点：[390整图](after-focus-390.png) / [原尺寸局部](after-focus-390-navigation.png)
- 单行、展开、桌面、hover、晚序/反转/减少动画图同目录，before.json/after.json记录全部计算几何，motion.json含逐帧数据。

## 复现与产物

```sh
# frontend目录：构建这次受影响的前端
npx vite build --outDir /workspace/scratch/mobile-soft-selection-built
# 仓库根目录，serve为持久服务，其他为一次检查
node docs/reports/evidence/storefront-mobile-soft-selection-20261120/serve.mjs
node docs/reports/evidence/storefront-mobile-soft-selection-20261120/visual.mjs
VERSION=after node docs/reports/evidence/storefront-mobile-soft-selection-20261120/visual.mjs
node docs/reports/evidence/storefront-mobile-soft-selection-20261120/motion.mjs
node docs/reports/evidence/storefront-mobile-soft-selection-20261120/hover.mjs
python3 docs/reports/evidence/storefront-mobile-soft-selection-20261120/ink.py
```

脚本依赖现有隔离后端及5181旧产物，不可对生产运行。旧入口index-AFyOY6U_.js，新入口index-BqwjGagB.js；实际源码/资产/证据SHA见manifest.json。首次编辑工作目录错误触发的旧源码构建未作候选证据；实际源码修正后构建PASS。视觉焦点固定延迟曾读到动画末帧，已改为等待真实CSS动画完成，最终PASS；失败原因在任务文档保留。清理仅本批临时after-latest.json，保留共享运行环境与正式证据。原生CI结果及精确head记录于PR，云端不合并或部署。
