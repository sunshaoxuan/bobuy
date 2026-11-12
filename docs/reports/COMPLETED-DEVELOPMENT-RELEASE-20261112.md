# 开发区域完成项生产交付

## 目标和范围

用户授权核查开发区域中已完成且未发布的开发并发布。执行方法、边界和验收预算见[任务指导](../plans/COMPLETED-DEVELOPMENT-RELEASE-20261112.md)。本批只纳入商品图片上传反馈，已于2026-11-12 13:53:06日本时间上线，生产验收通过。

29个工作树已逐一记录提交、应用差异和脏文件指纹。多数已提交业务修改已由生产继承。商品介绍会话已独立发布Core5a9bb64和前端3a8b11a，本批完整继承。旧整合快照2bff418已由过滤整合d0cc6aff替代，根目录历史草稿、测试门禁草稿和缺少完成证据的未提交改动保留原地。逐项来源见[初始盘点](evidence/completed-development-release-20261112/worktrees-initial.json)，实时容器及活动发布检查见[生产前检](evidence/completed-development-release-20261112/runtime-preflight.json)。

## 图片上传候选

原始候选位于gallery-upload-feedback-20261109工作树，HEAD82b8daf7，8个源码/测试文件的[原始指纹](evidence/completed-development-release-20261112/gallery-original-source.json)和补丁归档。本批在隔离工作树按增量整合，未改原工作区。

- 文件选择后即时复制FileList；逐文件显示等待、上传、确认成功或失败/未确认。
- 按实际准备后字节的SHA256复用已确认资源，WebP/AVIF转换PNG后使用转换后的文件名和摘要。
- 部分成功保留在草稿，首次失败后的文件继续等待；不自动重试HTTP或保存主档。
- 商品、身份、注销/重登、卸载形成操作归属边界，旧异步结果不能写入新编辑器；同主体令牌刷新保留草稿。
- 保存失败保留上传资源，显式再次保存，无需重复上传。服务端所有权、正式来源校验和100张图库上限沿用现有API。

外部高级模型最小请求两次失败后，DeepSeek建议经主Agent审查。批量保存卸载回调和URL规范化长度缺陷均先复现失败再修复。关于原始文件名的建议因现有API第四参数实际为标签而排除，并由真实WebP上传证据确认。见[复核结论](evidence/completed-development-release-20261112/advisory-resolution.md)。

## 验收事实

针对性测试15项通过。使用精确生产Core JAR、独立临时数据库及合成私有主档，真实Chrome正常登录和实际HTTP通过原生文件选择、同字节去重、部分失败保留、失败保存后重试、完整刷新回读、WebP转PNG、第二账号读取及上传拒绝。受控400和409仅用于错误分支，成功上传和保存均使用真实服务；未写生产客户数据。最新[浏览器结果](evidence/completed-development-release-20261112/gallery-visual-final.json)保留请求摘要、回读版本、其他字段不变及截图信息。

原长文件名布局在主Agent截图审查时判失败，保留修复前截图。最终窄屏采用文件名与状态分行，完整文件名可展开。Windows子像素字体按实际截图采样，状态标签留白及光学中心预算通过，手机新增详情和主要上传操作高度44px。功能、像素和视觉分开记录。[像素指标](evidence/completed-development-release-20261112/glyph-metrics.json)不替代主Agent视觉判断。Gemini Pro最小图片请求失败两次，gemini-3.8-flash-high图片请求及页面复核成功；其首轮意见中的标签挤压已修复，四点截断猜测由CSS原生ellipsis代码排除。既有横向标签栏和滚动裁切保持原编辑器行为。

统一Node20前端检查811项测试全部通过，165组suite通过，i18n、TypeScript和生产构建成功。精确发布源码c3bb160的[CodeQL三语言任务](https://github.com/sunshaoxuan/bobuy/actions/runs/43157145194)全部成功。首次完整测试沿用同一运行，最后的CSS调整只使页面/构建输入失效，JavaScript和测试输入未变，生产构建使用最终CSS完成。无额外重复全量。

## 生产和数据边界

前端镜像为bobuy/frontend:20261112.gallery-upload-feedback，镜像ID为sha256:5740727b6801a888be885691ef112955729aecf50bfab2c8f779bc038058fd9a，源码c3bb160c7a8f0541b06089e2a3eacca05008198d。前端制品、发布器和门禁均在[artifact.json](evidence/completed-development-release-20261112/artifact.json)绑定。共享发布锁及容器基线CAS防止覆盖并行发布。

Core仍为5a9bb64、原容器f69d14b5，schema仍V33。本次没有SQL迁移、业务数据写入、Core重建/重启或维护模式切换。旧前端3a8b11a镜像a509376c保留用于兼容应用回退，发布器保存compose前后快照并在失败时只恢复前端；禁止恢复旧数据库覆盖新写入。所有其他写服务及保护服务状态保持一致，详见[发布确认](evidence/completed-development-release-20261112/production-verify.json)和[最终运行快照](evidence/completed-development-release-20261112/runtime-final.json)。

生产真实Chrome在1440及320px检查本程好物、好物推荐的7种排序、热度及5星显示，后台现有商品图片与来源编辑器正常。37个实际加载JS/CSS摘要与候选匹配，无页面异常、控制台错误、HTTP失败或业务写请求。正常管理员登录后使用CSRF令牌注销；首轮QA脚本注销漏传CSRF导致403，修正脚本后完成，页面本身没有缺陷。首次结果独立保留。[最终浏览器验收](evidence/completed-development-release-20261112/production-browser.json)通过。

| 验收项 | 结果 | 证据 |
| --- | --- | --- |
| 所有开发区域归类 | PASS | worktrees-initial.json、worktree-protection.json |
| 原候选与其他脏改动保护 | PASS | 原图库工作树HEAD及全部原脏文件指纹不变；商品介绍会话独立推进另行记录 |
| 单元及真实HTTP工作流 | PASS | frontend-tests.json、gallery-compiled-final.json |
| 真实像素/响应式/视觉 | PASS | glyph-metrics.json、visual-acceptance.json、最终整体与原尺寸裁图 |
| CI/构建及精确制品 | PASS | ci.json、frontend-gates.json、artifact.json |
| 生产服务、数据和恢复边界 | PASS | production-activate.json、production-verify.json、runtime-final.json |
| 真实生产页面及资源 | PASS | production-browser.json及production-*.png |
| 本任务合成环境清理 | PASS | local-qa-cleanup.json、最终清理回执 |

原工作树无需为本批再次发布；已完成且具有验收依据的新增开发已上线。根目录和测试工具草稿缺少完整验收，保持原状。main归档是记录整合，不触发再次生产部署。
