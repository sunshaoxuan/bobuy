# 好物推荐固定分类导航 2026-11-20

基线origin/main 874a23cb4dc922298e2ef4ea2c4938c96f6f17cb，独立分支feat/storefront-sticky-categories-20261120。用户授权云端实现普通PR，本机协调发布；不吸收本机草稿，不改商品/分类数据、其他页面或性能批次。

范围：/products无搜索时标题/根分类快捷栏持续可见。总览保持现有渐进货架；选择根/直接叶类继续现有category URL和过滤，选中根清晰标示，叶类沿用路径。增加总览入口。上划后标题与图标上移缩小，sticky顶距由既有.store-header真实高度更新；固定外层占位，内部视觉收拢，避免商品布局跳动。保留横划、纵向滚动、浏览器返回/滚动恢复、键盘、44px触区和reduced-motion。

修改/最小验证：PublicProductCatalog仅/products导航呈现与根选中推导；CategoryShortcuts选中语义、总览入口、横向位置恢复/选中可见；新增小型CatalogDock封装sticky测量/收拢；public-catalog.css仅新容器限定样式。定向运行该目录组件、快捷栏与Dock关联测试（不全量）；真实现有隔离Spring/PG/Vite，1920×900、390×844、360×800展开/收拢/选中与叶类直接入口、返回恢复、手机搜索顶栏高度、横划/键盘/reduced-motion、控制台网络与计算几何。按仓库§9补1280×800单画面，不扩展其他页面检查。

预算：实现35分钟、定向检查15分钟、真实浏览器30分钟、原生CI30分钟。复用既有依赖/后端产物和合成数据，不写DB、不重建后端、不重跑性能。最终一次前端产物用于浏览器验收；冻结后跟踪同一自动CI。M3/M6没有可用外部模型连接时沿用既有主Agent实现/原图复核降级，不宣称外部PASS。

## 标准验收条款
（每个相关 issue 必须附上）
```text
功能与美观同时验收，须符合 docs/ui-ux-guidelines.md：
- 功能按本 issue 需求逐条通过，不改变未授权行为。
- 视觉与所在页面现有 UI 一致：复用已有 token 与组件，禁止原生未样式化控件，新控件与相邻控件齐高、同圆角档、间距统一。
- 具备默认 / hover / focus-visible / 选中或激活态；触控目标 ≥ 44px；键盘可操作；有可见标签或 aria-label；对比度足够。
- 四语文案（含较长的 en-US / ja-JP）在窄屏不溢出、不重叠。
- PR 附 390px 与 1280px 的改动区域截图（含关键状态）。Playwright 可用则用现有脚本或一次性检查生成。
- 主移动断点 767px 及 390px 下布局正常换行，无横向溢出。
- 只运行与本次改动相关的最小测试；PR checks 通过。
```


## 实施记录
- 已确认main874a23cb，未吸收调查分支/本机草稿。只复用现有公开目录categories，没有新增API、商品/分类写入或取价变更。
- 实测根类接口同时返回20条items与叶类8条shelf预览。为满足所选类纵向完整浏览，仅/products选类后显示既有分页items，其他页面及默认总览不变。补直接叶类根高亮、完整items不受预览截断的用例。
- Dock固定156px导航占位，收拢仅使内部表面从157到133px，标题24→20px、图48→36px，根入口最低84px；底部透明区域不拦截商品。实际手机顶栏120px，Dock top实时匹配。横滑位置按history key保存，直接叶类自动露出所选根。新增全部入口与aria-current/深底白字/下划线。
- 首次定向命令误从仓库根运行未载入jsdom，未形成有效结果；改frontend cwd后CatalogDock1+PublicProductCatalog21共22 PASS，既有jsdom window.scrollTo警告不作为真实浏览器错误。390真实Vite探测无JS错误、root2显示完整20件；修正全部图标在选中深底中的对比度。下一步仅生成候选前端产物一次做最终UI证据，不重跑性能或后端。

- 最终功能浏览器1920/390/360：展开/收拢/选中、20件仅所选类、叶类直达、横滑与桌面箭头、键盘焦点/Enter、返回后纵横位置恢复均PASS。390→900→390真实断点顶栏120→76→120，Dock同步无重叠。四语360及reduced-motion通过，1280展开几何补图通过。
- 主Agent原图复核发现App既有半透明顶栏在收拢截图透出底下排序字，容易混读；仅:has(.catalog-dock)的/products顶栏改白底，不改其他页面。该CSS输入使截图需更新：只重建前端和重拍既有状态/检查顶栏背景与几何，不重复已PASS的导航/手势/返回功能及单测。

- 最终补项touch PASS：手机纵滑420→615px，透明23px区域命中商品。证据目录README、manifest与13组最终整图/局部已保存；正式源码与最终产物绑定。单测22 PASS，功能/视觉/触摸均PASS；冻结后仅跟踪原生CI，不再扩大测试。更新UI标准17.3记录已验收模式。发布仍由本机协调，本任务不合并或部署。

## 首次CI修复（同PR）
- 原生CI44667398188前端失败：两个ProductMarkerCatalog用例因新dock只在非shelf模式挂载sortControls而失去总览控件，直接相关。恢复/products所有dock状态的控件，并覆盖既有shopping-overview隐藏规则，使排序和标记优先可实际使用；仍位于固定导航下方正常文档流，不扩充固定栏高度。
- RecommendationFromProduct冲突用例失败时DOM实际按钮名为“loading Register this issue with selected product”，断言读取到了Ant Design加载退出前的短暂状态；组件及测试未引用本批改动文件。仅执行一次该失败用例定位，不修改无关代码。
- 失效输入为CatalogSection控件条件和总览样式：重验ProductMarkerCatalog3+PublicProductCatalog21，重建前端后仅补总览7个展开/收拢画面、控件真实操作与收拢坐标；复用选类/叶类/返回/触摸/reduced-motion已成立PASS。修复预算15分钟+原生新运行。

- 定向目录24 PASS；无关推荐冲突用例单独1 PASS/8未运行，不改该组件/测试。控件浏览器脚本首次将overview请求路径误写为/product-overview（真实为/product-browse/overview），390点击URL/状态已成立但请求断言失败，结果JSON尚未保存；修正脚本路径后只重跑本次控件补验以生成完整记录，不改应用。

- 控件实际切换排序后，既有合成夹具中的外部图片产生ERR_TUNNEL_CONNECTION_FAILED，前两次未带requestfailed URL记录而中断汇总。补失败URL采集并保留控制台原样；仅允许确认是非本地图片的环境隧道失败，页面异常/本地API失败仍阻断。此为补齐新暴露网络证据，不改图片/数据/功能。之后每视口即时保存，避免重跑已有完整记录。

- 修复后controls四视口PASS，7组总览最终图已更新，360主Agent原图复核通过。控制台仅390排序出现两张既有外部夹具图片隧道失败，具体URL已记录；无页面异常或本地API失败。最终产物index-BwTi2D8X.js，24定向PASS+复用Dock1 PASS，无关失败用例单独PASS。冻结修复提交，继续同PR新原生运行。

## 选中浅灰样式修正（独立批次 2026-11-20）
用户否决生产5ce6183a的大黑选中背景。本批从origin/main 5ce6183a5e6d34ea16b0e94f0aed6b17caa7e860创建fix/storefront-category-light-selection-20261120，仅改/products Dock分类选中与选中hover：#eeeee9浅暖灰、#242424深字、1px内侧灰描边，保留下划线/现有焦点；hover为#e5e5df，普通hover沿用#f0f0ed。内侧描边用inset box-shadow，不增加盒尺寸。全部入口同规则。

只改public-catalog.css三条选中规则，更新UI指南17.3。图标/标题/热区/收拢/吸顶/分类数据和JS逻辑不改。复用PR166最终24目录测试+Dock1以及浏览器功能、移动手势、返回/reduced-motion；不重新运行。前端构建仅用于实际CSS产物取证，复用现有Spring/PG/合成数据。预算实现5分钟、受影响浏览器颜色/几何15分钟、原生CI30分钟。1920×900、390×844、360×800展开/收拢选中（含全部）、普通/选中hover、可见焦点；整图与同区域原尺寸局部，1280×800仅补一张标准展开态。真实网络/控制台记录；M3/M6沿用主Agent原图复核降级，不等待模型网关。独立普通PR，不合并或触发生产，本机协调发布。

执行偏差：首次编辑命令误用frontend工作目录，文档路径不存在而未改动源码；随后的构建为旧输入，不用于验收。修正工作目录后实施样式，仅新的产物作为本批候选。

- 浅灰修正visual PASS：三指定视口六态+1280一态共19组整图/局部；全部展开/收拢/hover计算值通过，尺寸/首卡位置保持，无页面/控制台/API错误。主Agent原图复核通过。最终index-C4eyFPO_.js及CSS摘要保存；只跟踪新PR原生CI，既有功能PASS继续复用。
