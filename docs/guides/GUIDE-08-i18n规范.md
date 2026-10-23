# GUIDE-08: i18n 国际化规范

## 目标
- 系统统一支持 `zh-CN`、`en-US`、`ja-JP`、`zh-TW`
- 默认语言为 `zh-CN`
- 所有用户可见文案必须走词条资源，禁止在页面与接口返回中硬编码

## 前端规范
- 语言资源文件位于：
  - `frontend/src/locales/zh-CN.ts`
  - `frontend/src/locales/ja-JP.ts`
  - `frontend/src/locales/en-US.ts`
  - `frontend/src/locales/zh-TW.ts`
- 商城与工作台新增词条在前三语对应的 `experience.<locale>.json`，由同语言资源合并；繁中资源完整独立维护。首次繁中由 OpenCC cn→tw 转换并校对品牌，后续新增词条必须四语同时维护。
- 品牌为「宝宝败」「BoBuy」「ボボバイ」「寶寶敗」，禁止页面自行拼写英文名。
- 统一通过 `frontend/src/i18n.tsx` 中的 `t(key)` 取词
- `supportedLocales` 必须包含以上四语。界面资源键集合必须完全一致，不采用中文运行时 fallback 隐藏缺译；缺失键在测试中失败。
- `t(key, values)` 使用 `{name}` 插值。注册模式、订单状态等业务值始终使用稳定枚举，翻译仅用于显示。
- 语言选择覆盖商城、后台和商家登录，持久化到既有 `bobbuy_locale`；切换同步 `html.lang`、页面品牌标题、Ant Design、dayjs 和请求 `Accept-Language`，保留购物车及表单状态。
- 新增页面或组件时：
  1. 先定义词条 key
  2. 四种语言同时补齐
  3. 组件中只保留 key，不保留硬编码文案
- 多语商品/供应商内容使用当前语言。商家未提供译文时按简中、英文、首个非空值展示原文；这属于内容缺译策略，UI 词条仍须四语完整。

## 后端规范
- 后端国际化资源文件位于：
  - `backend/src/main/resources/messages_zh_CN.properties`
  - `backend/src/main/resources/messages_zh_TW.properties`
  - `backend/src/main/resources/messages_ja_JP.properties`
  - `backend/src/main/resources/messages.properties`（英文默认）
- 所有接口错误信息统一使用 message key（`ApiException + MessageSource`）
- 禁止直接返回硬编码错误文案
- 通过 `Accept-Language` 协商语言，默认 `Locale.SIMPLIFIED_CHINESE`

## 开发检查清单
- [ ] 所有新增/修改文案是否已抽取为词条
- [ ] 四语资源键与插值占位符是否一致且非空
- [ ] 默认语言是否仍为中文
- [ ] 前后端异常信息是否均可随语言切换
- [ ] 回归测试（前端 test/build、后端 test/package）是否通过
