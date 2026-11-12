# 社交平台选择验收

合成账户本地真实运行截图，浏览器功能和26个原尺寸控件像素量测通过。accepted 为最终状态，before-fix 为可拒绝原错误的负例。desktop-full 是桌面整体；手机截图同时覆盖分组、长名称、无匹配、必填及360×580短屏。Gemini意见独立保留，主Agent最终判断见主报告。

tests.json 为30项相关测试；browser.json 区分开发热更新历史错误与最终编译运行；build-final.log 为同步88bdadc后重建。源码、依赖与CSS相同的截图/测试复用，整包资源变化后补充编译截图。control-pixels 的 label 是所选平台，搜索中实际字形来自PNG像素，不把标签当OCR结果。

最终生产源码ec24fa9，版本20261112.social-platform-select.2，CI三项成功。production-browser为最终只读网络与控制台记录；production-control-pixels为9个受影响控件的独立字形量测，其他有效状态沿用原证据。最终本地20个控件通过。production-corrected-*私有截图是最终修正帧，未发送外部模型。initial-release为首轮发布及失败记录的只读归档，其中脚本为历史快照，不从归档目录执行。生产镜像、健康与两枚旧标签清理见artifact、production-cleanup、superseded-cleanup。实际全页测试资料截图为final-desktop-full.png。
