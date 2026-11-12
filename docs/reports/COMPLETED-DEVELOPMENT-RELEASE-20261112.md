# 开发区域完成项生产交付

## 目标和范围

用户授权核查开发区域中已完成且未发布的开发并发布。执行方法、边界和验收预算见[任务指导](../plans/COMPLETED-DEVELOPMENT-RELEASE-20261112.md)。本批只纳入商品图片上传反馈。当前为候选验收阶段，生产尚未切换。

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

统一前端测试、i18n/TypeScript/生产构建、精确候选CI、生产镜像及资源验收尚待完成。后端及数据库无增量，schema保持V33；本批仅计划切换frontend容器，当前Core和保护服务身份必须保持一致。
