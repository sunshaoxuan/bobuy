# 好物推荐固定分类导航：隔离验收

基线 `874a23cb4dc922298e2ef4ea2c4938c96f6f17cb`；候选源码及浏览器产物 SHA-256 见 [manifest.json](manifest.json)。首轮加载生产构建 `index-CsMIAdqX.js`（控件修复后的最终产物为 `index-BwTi2D8X.js`），5176 静态服务器代理既有 Spring 18080 / PostgreSQL 18.6 合成环境。没有 API mock、生产访问、业务数据写入或后端重建。23 个合成根类、463 件公开商品沿用已有夹具。

## 结果

- `browser.json` PASS：1920×900、390×844、360×800 展开/收拢/选中、完整所选类20件、直接叶类、键盘焦点与 Enter、桌面箭头、手机真实横向触滑、浏览器返回纵横位置恢复。无页面/控制台错误，记录中的 API 响应均小于400。
- 固定槽位156px；标题24→20px、图标48→36px、分类热区100→84px（宽88px）；桌面箭头44×44px。首卡文档坐标收拢前后变化小于1px。无整页横向溢出。顶距随实际顶栏120→76→120px变化。
- `touch.json` PASS：390px实际纵向触滑420→615px，只显示所选类；收拢表面下23px透明区域可命中商品，不拦截点击。
- 四语360px和 reduced-motion：额外繁中/英文/日文直接叶类状态及零过渡时长，简中见三视口主流程。1280×800补充展开态及计算样式。
- `visual.json` PASS：功能检查后发现旧半透明顶栏透字，仅新增Dock所在页顶栏改白底；CSS输入变化后只刷新13个状态截图/几何，复用手势、返回及单测PASS。主Agent看过最终390选中整图与1920收拢原尺寸局部；360/日文原图已复核。没有外部模型服务PASS声明。

## 文件与重现入口

`expanded-*`、`compact-*`、`selected-*` 为最终整图，相应 `-navigation.png` 为原尺寸局部；`reduced-*` 为三种其他语言的360px收拢态。详细计算宽高、圆角、边框、背景、阴影、焦点及请求路径见 JSON。

```sh
# frontend cwd：已执行，22 PASS（1 Dock + 21 Catalog）
npx vitest run src/components/CatalogDock.test.tsx src/pages/PublicProductCatalog.test.tsx
# frontend cwd：生成最终浏览器产物（不替代原生CI）
node node_modules/vite/bin/vite.js build --outDir /workspace/scratch/sticky-built
# repository cwd；依赖已有隔离后端和合成夹具
node docs/reports/evidence/storefront-sticky-categories-20261120/serve.mjs
node docs/reports/evidence/storefront-sticky-categories-20261120/browser.mjs
node docs/reports/evidence/storefront-sticky-categories-20261120/visual.mjs
node docs/reports/evidence/storefront-sticky-categories-20261120/touch.mjs
```

脚本是本次已执行的证据入口，不要求交付时重跑。功能首轮使用相同JS逻辑的前一CSS产物，最终截图与触摸补项使用manifest产物。单测既有jsdom scrollTo警告不等于真实浏览器错误。未重新执行性能对照，也不宣称生产验收或部署。合成类名不代表所有真实长名称；两行截断/完整title沿用原组件。1280仅补展开态，其余三指定视口覆盖主要状态。

临时根目录 `.vite/vitest/results.json` 和本任务早期 probe 图片/脚本已清理；共享依赖、隔离后端、最终构建与正式证据保留供协调者审阅。

## 同PR控件修复：最终候选

首次CI [44667398188](https://github.com/sunshaoxuan/bobuy/actions/runs/44667398188) 的两个ProductMarkerCatalog失败直接来自总览未挂载sortControls。恢复所有dock状态的排序/标记优先，并仅在新dock页面覆盖既有总览隐藏样式。两项在分类栏下正常文档流显示，不增加固定栏高度。

- `npx vitest run src/pages/ProductMarkerCatalog.test.tsx src/pages/PublicProductCatalog.test.tsx`：24 PASS。Dock源码未变，原1 PASS复用。
- `npx vitest run src/components/RecommendationFromProduct.test.tsx -t 'keeps offer text on version conflict'`：1 PASS/8未运行。首次CI该失败的可访问按钮名实际为 `loading Register this issue with selected product`，而断言匹配无loading的完整名字；该组件不依赖本批文件。记录独立加载退出时序失败，不修改其源码或测试，跟踪新原生CI。
- `node docs/reports/evidence/storefront-sticky-categories-20261120/controls.mjs`：四视口PASS，更新7个总览展开/收拢整图和局部；记录新控件计算样式、真实点击markedFirst=false及rating-desc请求/URL、无收拢位移/遮挡/横向溢出。原尺寸360展开图主Agent复核通过。选类/叶类/返回/触摸/reduced-motion输入不变，复用前述PASS及其截图。
- 最终产物 `index-BwTi2D8X.js`，manifest保留前产物以说明复用边界。`controls.json`是受影响总览的最终几何/网络依据，替代前JSON中的对应总览坐标；其余证据保持有效。
- 最终控件补验无页面异常、本地API失败。390排序后露出的旧夹具两张外部图片出现 `ERR_TUNNEL_CONNECTION_FAILED`（cdn.bobbuy.example与images.costco-static.com），URL及控制台记录在controls.json；如实记为隔离环境外部图片限制，不宣称该步骤控制台零错误，不改数据/图片。另两个早期补验分别因脚本接口路径笔误及缺少失败URL采集而中断；修正证据脚本后已完成，不影响应用代码判定。
