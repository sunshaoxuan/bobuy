# 手机五入口与连续过渡验收（2026-11-20）

基线 `583c3e55218eca377a7200527aeb5ba3077e9b21`，独立分支 `fix/storefront-mobile-five-category-motion-20261120`。仅修改手机收拢宽度、手机宽度/gap过渡，以及已可见活动项在有限过渡期间的保护；不改分类、商品数据或过滤。未合并或发布。

## 实测结果

真实 Chromium / 现有隔离 Spring + PostgreSQL 18.6，合成商家1000的23根类×20商品；此次无数据库写入。旧产物5180、新产物5181，同 URL、scrollY=420、DPR1。

| 项目 | 360×800 | 390×844 |
| --- | --- | --- |
| 轨道起点完整入口（包含全部、两侧4px内边距） | 4 → 5 | 4 → 5 |
| compact入口宽 | 76 → 59.1875px | 76 → 60px |
| 相邻图标中心距 | 82 → 65.1875px | 82 → 66px |
| 热区高 / 间隙 | 72px / 6px | 72px / 6px |
| 表面高 / 图标 / 标签 | 109px / 28px / 13px、18px行高 | 相同 |
| 收拢布局采样不同宽度 / gap值 | 11 / 11 | 10 / 10 |
| 指定长名较长行总字形余量 | 3.171875px | 3.984375px |

- 两方向180ms ease-out均有多个中间值。`layout.json`保存宽度/gap/图标逐帧值；`motion.json`保存最终JS的双向、85ms快速反转及活动项边界逐帧值。非用截图或延迟伪装动画。
- 最终JS：360/390双向各12种宽度值，快速反转各10种；保护采样的左右边缘始终在轨道内（最小余量≥3.54px）。直接URL进入第19根类后，从商品和分类栏开始的真实CDP触摸上滑均通过。
- 横向意图超过6px并大于纵向移动后停止保护；动画中主动横滑、将选中项隐藏后继续纵滚、不自动拉回均通过。浏览器返回恢复隐藏项的纵横位置：360为y450/x703，390为y450/x844。快速反转清理旧追踪；动画停止后不继续调整。
- reduced-motion：轨道与入口transition-duration均0s，只有起止宽度，无中间动画，选中仍完整。
- “面包谷物与抹酱”为“面包谷物”/“与抹酱”，“个人护理与美容”为“个人护理”/“与美容”；两行36px、scrollHeight=clientHeight、全部字形在链接内，保留浅灰/内描边/下划线。标签是浏览器DOM临时替换的真实文字形态，服务端仍是合成类名；未把夹具当成生产数据。
- 手机展开和1280×800桌面展开/收拢计算几何与基线完全一致；固定槽156px、首卡文档坐标不变。没有整页横向溢出，所有入口≥44×44px。此前透明区商品触摸、渐进加载及分类功能证据按未变输入复用。
- 两套脚本均无页面/控制台错误、API错误状态。只做直接布局隔离，未重复桌面1920或全部业务流程；无生产性能/生产验收结论。主Agent已查看整图和原尺寸局部，沿用M3/M6既定视觉降级。

## 图与原始记录

- [360最终收拢整图](after-compact-360.png)、[原尺寸导航](after-compact-360-navigation.png)
- [390最终收拢整图](after-compact-390.png)、[原尺寸导航](after-compact-390-navigation.png)
- [360长名整图](after-bread-360.png)、[原尺寸局部](after-bread-360-navigation.png)
- [390长名整图](after-bread-390.png)、[原尺寸局部](after-bread-390-navigation.png)
- [360晚序选中](late-compact-360.png)、[390晚序选中](late-compact-390.png)
- 同目录共22组整图/原尺寸导航局部；before/after为同条件对照，late为最终手势JS。原始数据见 `layout.json`、`motion.json`。

## 命令、产物与复用边界

仓库根目录：

```sh
cd frontend
npx vitest run src/components/CatalogDock.test.tsx
npx vite build --outDir /workspace/scratch/mobile-five-motion-built
cd ..
node docs/reports/evidence/storefront-mobile-five-motion-20261120/serve.mjs
node docs/reports/evidence/storefront-mobile-five-motion-20261120/layout.mjs
node docs/reports/evidence/storefront-mobile-five-motion-20261120/motion.mjs
```

服务器命令为持久进程；脚本依赖既有5180旧产物、18080隔离应用及合成目录，不适用于生产。Dock定向10/10 PASS，前端构建PASS。原生CI以PR最终提交为准，状态/链接记录在PR。

布局证据使用首候选 `index-CSi40-JO.js`；随后只把任意pointerdown取消细化为横向意图取消并补纵向手势单测。最终 `index-AFyOY6U_.js` 重验10项Dock与完整motion脚本，布局CSS/DOM未变，保留已成立layout与长名图。实际源码、所有构建资产与证据SHA-256见 `manifest.json`。第一次新单测的两项夹具时序失败及修正记录在任务文档，不隐去失败、不修改无关测试。
