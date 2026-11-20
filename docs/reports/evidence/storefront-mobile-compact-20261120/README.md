# 手机收拢分类栏：2026-11-20

基线origin/main `40d3e0197c2f69381f261352ce934c93c0344638`。应用仅追加现有767px移动断点内、`data-compact=true` 的4条CSS；JS、商品/分类数据、渐进加载、浅灰选中、标签字级与固定156px槽位不改。候选不合并/发布，本机协调。

## 同条件量化结果

现有真实隔离Spring18080/PG18.6、合成类7的20件商品；复用前批5177产物 `index-C4eyFPO_.js`，候选5178产物 `index-fXUHmNta.js`，无API mock或DB写入，后端未重建。390×844与360×800均使用Chromium `isMobile:true, hasTouch:true, deviceScaleFactor:1`，前后相同URL与scrollY=420。[visual.json](visual.json)为完整计算样式、网络、触摸与隔离记录，[manifest.json](manifest.json)绑定实际产物。

| 指标 | 修改前 | 修改后 |
| --- | ---: | ---: |
| 手机吸顶表面 | 133px | 109px（-24px） |
| 标题到图标边框间距 | 15.5px | 7.5px（-8px） |
| 图标 | 36×36px | 28×28px |
| 分类入口 | 88×84px | 88×72px |
| 标题行 | 40px | 32px |
| 390商品可视高度（吸顶表面至底栏） | 521.70px | 545.70px（+24px） |
| 360商品可视高度（吸顶表面至底栏） | 477.70px | 501.70px（+24px） |

- 固定槽仍156px，前后及展开→收拢首卡文档坐标完全相同：390为416.75px，360为469.546875px。缩短表面后多出的空间可见真实商品，不制造商品布局跳动。
- 标签仍13px/18px；浏览器DOM临时将选中标签替换为明确合成的“合成分类饮料与调味品”，两行高36px且scrollHeight=clientHeight，图/文间距2px，标签底部在72px触区内，无截掉第三行或超出。只是浏览器显示夹具，不改服务端数据。
- 透明余量23→47px；`elementFromPoint` 命中商品，真实CDP触摸pointerdown到达同一商品，随后纵滑390的420→485、360的420→562。未产生点击/详情导航或业务写入。
- 手机展开态前后计算对象完全相同；1280×800桌面展开与收拢前后完全相同。390切至768px后恢复图36px/表面133px，断点隔离PASS。原移动横滑/选类/返回/reduced-motion功能引用PR166/167有效PASS，不重复全套。
- 无整页横向溢出；页面/控制台错误为空，所记录本地API均成功。原灰底/细边/下划线保持。

## 截图与命令

`before/after-expanded-*` 与 `before/after-compact-*` 是同区域展开/同scrollY收拢前后整图；`after-long-label-*` 是两行合成标签。每张均有 `-navigation.png` 原尺寸局部，共14组整图/局部。主Agent看过390最终收拢整图、390两行局部及360两行整图；字形、选中态和触区清楚。沿用M3/M6主Agent视觉降级，没有外部模型PASS声明。

```sh
# frontend cwd：仅一次候选前端构建
node node_modules/vite/bin/vite.js build --outDir /workspace/scratch/mobile-compact-built
# repository cwd；既有5177基线和18080后端保持运行
node docs/reports/evidence/storefront-mobile-compact-20261120/serve.mjs
node docs/reports/evidence/storefront-mobile-compact-20261120/visual.mjs
```

原目录24+Dock1测试及既有功能PASS按未变JS/依赖复用，不运行本地全量或新建后端环境；原生新PR CI直接跟踪。两行长名是浏览器合成布局压力输入，不代表真实商家分类修改；本批不是生产验收。正式证据、候选构建及共享环境保留，没有额外临时截图待清理。
