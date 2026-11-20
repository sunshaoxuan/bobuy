# 手机收拢分类横向间距：2026-11-20

基线main `fe3c7ce0e40759e1d0bd857ff70174cafcd158d4`。应用仅改既有767px移动断点且compact状态的轨道gap，并增加li flex-basis规则：88px+8px→76px+6px。不改JS、数据、图标/字级/栏高、展开或桌面。本候选交本机合并/发布，云端不操作生产。

## 实测结果

真实隔离Spring18080/PG18.6与既有合成数据；基线5178 `index-fXUHmNta.js`，候选5179 `index-BeBU4PRt.js`。390×844、360×800均 `isMobile:true, hasTouch:true, deviceScaleFactor:1`，同URL和scrollY=420，分类轨道从起点比较。未mock接口或写数据库，后端未重建。摘要见[manifest.json](manifest.json)，计算值、网络与手势结果见[visual.json](visual.json)。

| 指标（两手机均相同） | 修改前 | 修改后 |
| --- | ---: | ---: |
| 相邻图标中心距 | 96px | 82px |
| 分类热区 | 88×72px | 76×72px |
| 相邻热区间隙 | 8px | 6px |
| 轨道起点完整可见入口数（含全部） | 3 | 4 |
| 吸顶表面 / 图标 | 109px / 28px | 109px / 28px |
| 文字 / 行高 | 13px / 18px | 13px / 18px |

- “面包谷物与抹酱”在真实选中类链接上临时替换为浏览器布局夹具：候选显示为“面包谷物与”/“抹酱”两行，标签72×36px；scrollHeight=clientHeight、边界完全位于76×72px入口内。长行DOM字形范围65.015625px，横向总余量6.984375px（居中每侧约3.49px，另有入口内边距2px），canvas墨迹宽约65.00006px。原尺寸局部可读，无裁字或缩字号。服务端分类未修改。
- 基线与候选两手机均实际CDP横向触滑，轨道发生滚动、页面纵坐标保持420；随后真实触摸选类，正确category URL与灰底/细边/下划线仍在。保留109px高度和156px固定槽。
- 手机展开态前后计算对象完全相同，1280×800桌面展开/收拢前后完全相同。无整页横向溢出，页面/控制台错误为空，记录的本地API均成功。
- 主Agent已看360最终收拢整图及长名局部、390长名选中整图，完整入口增加且字形余量清楚。M3/M6沿用主Agent视觉降级，不宣称外部模型PASS。

## 证据与执行

`before/after-expanded-*`、`before/after-compact-*` 为前后同区域整图；`before/after-selected-long-*` 为手机横划后选中长名。各有 `-navigation.png` 原尺寸局部，共16组整图/局部。

```sh
# frontend cwd，一次候选产物构建
node node_modules/vite/bin/vite.js build --outDir /workspace/scratch/mobile-spacing-built
# repository cwd，复用现有5178基线/18080后端
node docs/reports/evidence/storefront-mobile-spacing-20261120/serve.mjs
node docs/reports/evidence/storefront-mobile-spacing-20261120/visual.mjs
# 仅当对应视口证据未成立且其余已保存时使用
VIEWPORT_ONLY=1280 node docs/reports/evidence/storefront-mobile-spacing-20261120/visual.mjs
```

首次断言仅旧基线5.984375px剩余宽度低于预设6px，核对为子像素舍入后仅放宽基线0.1px，候选仍要求≥6px。手机PASS保存后，桌面读到动画末帧中间尺寸；验收脚本改为等待真实CSS动画finished，仅重验1280桌面。应用未因此改动或重建。最终visual.json汇集两手机有效PASS与稳定桌面PASS。

旧分类/返回/纯当前类纵滑/透明区域触控/reduced-motion功能与目录24+Dock1测试按未变JS依赖复用，不重跑本地全套；原生PR CI直接跟踪。长名为浏览器临时显示夹具，本批不是生产验收。正式证据及候选构建保留，没有额外临时截图待清理。
