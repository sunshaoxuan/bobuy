# 分类栏浅灰选中：2026-11-20

从生产main `5ce6183a5e6d34ea16b0e94f0aed6b17caa7e860` 独立修正用户否决的大黑选中背景。应用只变动 `public-catalog.css` 三条选中规则，限定 `.catalog-dock`；不改JS、分类/商品数据、其他页面或尺寸。当前候选未合并/发布，本机负责。

选中（包括全部）背景 `#eeeee9`、文字 `#242424`、1px内侧 `#d1d1c9` 描边与原下划线；选中悬停 `#e5e5df`。普通悬停沿用 `#f0f0ed`，无选中描边/下划线。原2px键盘焦点保留；内描边不占布局尺寸。

## 本批结果

真实隔离应用，前端生产构建 `index-C4eyFPO_.js`，5177静态服务代理既有Spring18080/PG18.6；合成数据、依赖、后端产物均复用，无DB写入、mock响应、后端重建或生产访问。CSS与实际加载产物SHA见[manifest.json](manifest.json)。

[visual.json](visual.json) PASS：1920×900、390×844、360×800各六张整图与同区域原尺寸局部：全部展开、根类展开、根类收拢、普通悬停、选中悬停、键盘焦点。另核对全部收拢/悬停计算值，1280×800补全部展开标准图，共19组整图/局部。颜色与描边均按实际计算值断言，全部和根类使用同一规则。

- 分类热区仍88×100→88×84px，图标48→36px、方形；收拢前后首卡文档坐标差小于1px，无页面横向溢出。
- 记录width/height/min-width/min-height/radius/border/background/box-shadow/outline与下划线；普通hover无描边及下划线，选中hover仍为浅灰深字，焦点为可见2px实线。
- 无页面/控制台错误，所记录API响应均小于400。
- 主Agent已看390收拢整图、1920选中hover局部、360焦点与全部展开原尺寸局部，浅灰/描边/字形区分清楚。沿用M3/M6主Agent视觉降级，不宣称外部模型PASS。

## 命令与复用边界

```sh
# frontend cwd，仅构建改变的CSS对应浏览器产物
node node_modules/vite/bin/vite.js build --outDir /workspace/scratch/category-light-built
# repository cwd，复用既有隔离后端
node docs/reports/evidence/storefront-category-light-20261120/serve.mjs
node docs/reports/evidence/storefront-category-light-20261120/visual.mjs
```

PR166最终目录24+Dock1测试及分类/返回/手指滑动/reduced-motion功能PASS复用，相关JS与依赖未变；没有重复本地全套功能或后端测试。新原生PR CI直接跟踪。窄视口hover用浏览器指针模拟检查样式，触摸交互沿用前批证据；本批不是生产复测。首次工作目录笔误导致一次旧输入构建，未用于验收，见既有计划执行记录。正式截图/脚本/摘要与最终构建保留，无新增临时截图待清理。
