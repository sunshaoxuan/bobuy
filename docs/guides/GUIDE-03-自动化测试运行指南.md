# GUIDE-03: 自动化测试运行指南

> 2026-10-27 候选更新：图片统一使用 PostgreSQL `bb_recommendation_image`；原对象存储服务已从候选代码与部署依赖移除。生产切换状态和回退步骤以 [PostgreSQL 18 升级与图片存储说明](../reports/POSTGRES18-STORAGE.md) 为准，不能直接把旧数据目录挂给18启动。


**生效日期**: 2026-01-16  
**状态**: 执行中

---

## 1. 目的

统一前后端自动化测试的执行方式，确保覆盖率与验收门槛可重复验证。

---

## 2. 前端测试（Vitest）

### 2.1 运行单测
```bash
cd frontend
npm test
```

### 2.2 运行覆盖率
```bash
cd frontend
npm run test:coverage
```

**关注点**:
- `frontend/src/pages/Orders.tsx` 行覆盖率需 ≥ 60%。
- `frontend/src/pages/Trips.tsx` 行覆盖率建议 ≥ 60%。

---

## 3. 后端测试（JUnit + JaCoCo）

### 3.1 运行测试与校验
```bash
cd backend
mvn verify
```

### 3.2 覆盖率报告
- HTML: `backend/target/site/jacoco/index.html`
- CSV: `backend/target/site/jacoco/jacoco.csv`

**关注点**:
- `com.bobbuy.service.BobbuyStore` 行覆盖率需 ≥ 50%。
- `com.bobbuy.api.OrderController` 行覆盖率需 ≥ 50%。

---

## 4. E2E 测试（Playwright）

### 4.1 执行脚本
```bash
cd frontend
npm run e2e:prepare
npm run e2e
```

**说明**:
- `npm run e2e:prepare` 会先检测 Playwright Chromium 是否已存在，仅在缺失时安装。
- `npm run e2e` 默认串联 `e2e:prepare` 与 `playwright test`，适合本地与 CI 统一执行。
- 常规本地 E2E（`npm run e2e`）统一复用 `frontend/e2e/responsive_helpers.ts` 的共享 mock；其中 `**/api/**` 为 fallback mock，用于吸收未显式断言的 API，避免 Vite proxy `ECONNREFUSED` 噪声。

### 4.2 AI 专用回归（条件化，真实闭环）
`frontend/e2e/ai_onboarding.spec.ts` 不并入常规 `npm run e2e`，仅在专用环境执行。

```bash
cd frontend
npm run e2e:ai
```

Windows CMD:
```bat
cd frontend
npm run e2e:ai:win
```

最小环境要求：
- 前端：`RUN_AI_VISION_E2E=1`
- 后端 profile：`SPRING_PROFILES_ACTIVE=dev,ai-hermes`（必须）
- 外部模型：`bobbuy.ai.llm.edge.*` + `bobbuy.ai.llm.main.*` 可访问
- 对象存储：PostgreSQL 图片表 可访问（`bobbuy.minio.*`）
- 样本图片：`sample/IMG_1484.jpg`、`sample/IMG_1638.jpg`
- Sample golden：`docs/fixtures/ai-onboarding-sample-golden.json`
- Sample 对比脚本：`pwsh /home/runner/work/bobbuy/bobbuy/scripts/verify-ai-onboarding-samples.ps1`
- 预置数据：启用 `dev` profile 或 `bobbuy.seed.enabled=true`，保证已有商品识别路径可命中

通过标准（真实业务闭环）：
- `IMG_1484` 触发新商品创建，`/api/ai/onboard/confirm` 返回新 `product.id`
- 创建后商品列表（`/api/mobile/products`）可查到该 `product.id`，且 `itemNumber/brand/price` 与 AI 最终确认一致
- `IMG_1638` 命中已有商品，扫描结果 `existingProductFound=true` 且确认返回同一 `existingProductId`
- 若执行 sample 对比脚本，输出 `/tmp/ai-onboarding-sample-report.json` 与 `/tmp/ai-onboarding-sample-report.md`
- 抓图来源治理通过：`sourceDomains` 不包含小红书等禁用域名，且至少一张图属于 `OFFICIAL_SITE/BRAND_SITE/OFFICIAL_STORE/TRUSTED_RETAIL`

失败判定（按链路定位）：
- `error.ai.recognition_failed`：视觉识别失败
- `error.ai.web_search_failed`：联网抓图失败
- `error.ai.source_filter_empty`：来源治理后无可用图
- `error.ai.product_persist_failed`：商品创建/落库失败
- 前端用例在确认后列表未查到商品或字段不一致：前端确认后列表未同步/闭环失败

---

## 5. 常见问题

1. **覆盖率未达标**  
   优先补充关键业务路径与异常路径用例。
2. **E2E 无法启动**  
   确认端口未被占用，必要时关闭已有前端服务或调整配置。
3. **后端测试日志过多**  
   测试 profile 默认已关闭启动横幅、请求访问日志与常见 AI/FX 噪音；如仍需排查，可临时提升对应 logger 级别。
