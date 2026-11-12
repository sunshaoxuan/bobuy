# 社交平台选择验收

合成账户本地真实运行截图，浏览器功能和26个原尺寸控件像素量测通过。accepted 为最终状态，before-fix 为可拒绝原错误的负例。desktop-full 是桌面整体；手机截图同时覆盖分组、长名称、无匹配、必填及360×580短屏。Gemini意见独立保留，主Agent最终判断见主报告。

tests.json 为30项相关测试；browser.json 区分开发热更新历史错误与最终编译运行；build-final.log 为同步88bdadc后重建。源码、依赖与CSS相同的截图/测试复用，整包资源变化后补充编译截图。control-pixels 的 label 是所选平台，搜索中实际字形来自PNG像素，不把标签当OCR结果。

生产只读截图保存在gitignored private目录，未发送外部视觉模型。生产镜像、CI、健康及服务边界回执将在发布后补充。
