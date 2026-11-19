# Product master review workflow

## Current product introductions, 2026-11-12

Reviewed current master descriptions are exposed separately as `introduction` on eligible public product catalogue/detail entries. They describe the current product independently of immutable published recommendation text. All four languages require the current source hash and saved reviewer/time metadata. Reference-only products also require exact nonblank ITEM alignment with every same-owner published reference. Unlinked private, deleted, cross-owner, stale or unreviewed data gains no disclosure. Product visibility, prices, stock, historical descriptions, source specifications and publication snapshots remain unchanged. Both catalogue and recommendation detail use this current introduction in their product overview. Missing current introduction retains the existing historical description behavior.

The existing `/admin/stock-master` page contains the product-master panel. Saving a master supplies linked recommendation identity, Japanese source name, plain translations, specifications, categories, supplier and ordered official gallery. Recommendation source/channel, reference amounts, units, periods and conditions remain attached to the recommendation occurrence. Product sales, stock and visibility are not modified by master saves.

Existing profiles remain legacy until explicitly reviewed and saved. A nullable V16 `bb_product.catalog_data` column has no content backfill. Their existing recommendation text and official galleries continue to render while review is pending. New recommendation-created profiles are canonical immediately and remain private and unpriced.

## Short visible review path

1. Open product master from its existing StockMaster row, or choose **Review and complete product masters**.
2. Generate suggestions from linked recommendations. Suggestions preserve populated master values, normalize only exact known translated-name/Japanese suffix pairs, fill known missing facts, and flag source conflicts. They do not infer unknown brands/specifications.
3. Correct the JSON or individual editor. Preview validates ownership, record versions, field bounds, taxonomy and image provenance. Changing the JSON invalidates preview and confirmation.
4. Select the reviewed rows, acknowledge review, then confirm save. Save is atomic and optimistic-version checked. Stale/conflicting rows require reload and review; no silent overwrite.

The bulk JSON is an array of objects with `productId` (stable product ID), `version`, `name`, `description`, `itemNumber`, `brand`, `specification`, `model`, `packaging`, `categoryIds`, `supplierId`, `gallery`, and `translationsReviewed`. `name`, `description`, and `specification` use locale keys `ja-JP`, `zh-CN`, `zh-TW`, `en-US`. Japanese name is required; translations contain pure names, without a Japanese suffix. `gallery` reuses existing media objects, ordered with the first image as main image; images carry `url`, `type: IMAGE`, `visible`, `title`, `sourceUrl`, and optional existing provenance/hash fields. No selling-price, stock or visibility field is accepted by this workflow.

Image selection stages validated local files in the existing shared image store. They are associated only on confirmed master save. Source URLs must be HTTPS without credentials, query strings or fragments; operators verify the exact model/specification. Removing an association preserves original recommendation source evidence. No automatic external image fetching or source-content import is introduced.

Only reviewed current master translations are projected into recommendation translations. Source changes without translation review fall back to Japanese; issue-specific translated offer conditions remain bound to the issue source hash. Existing recommendation source facts remain available privately for offer editing and evidence. Master-owned metadata editors link to the master page instead of creating a second editable copy.

This document describes the candidate. Deployment and full browser acceptance status are recorded separately in `docs/reports/PRODUCT-MASTER-NEXT-BATCH.md`; do not infer production availability from this contract.


## 手动新增一件商品（2026-11-19 / PR #163 候选）

1. 在 `/admin/products` 点击「新增商品」。填写日文名称；可同时填写简体中文/英文名称、描述、规格、品牌与商品编号。日本语名称为必填，其他语言不自动复制或生成。
2. 分类使用现有树选择器选叶节点，不输入分类文字；可明确留为未归类。提交以树节点ID原子写主路径，不写旧分类FK或旧类别数组。
3. 点击「保存并关闭」（手机也须明确点击）。保存失败保留输入，可原请求重试；保存成功使用服务器回包显示，不把后来改动但未落库的草稿当作已保存。刷新后可按商品编号查找，通过「详情/商品主档」继续编辑。
4. 商品初始为商家私有且无已确认售价。之后打开「售价与调价」，由店主确认金额/币种/单位及原因；确认通常价不自动公开。核对资料和价格后，使用既有「公开商品与售价」独立确认入口。

手动创建不调用AI识别/翻译、不触发采购对账、不改变库存；原页面已有AI状态/任务GET轮询及worker配置保持原样。不同创建请求使用已有商品编号时拒绝（含软删），请找到或恢复原商品，不自动覆盖或合并身份。JSON补齐仍要求已有商品ID，不用于创建。媒体沿用当前主档HTTPS来源边界：无用户信息、query或fragment；已保存手动视频可原样保留随其他字段保存，主档编辑不能借此新增/换视频URL。

本候选无schema迁移、无真实商品回填。验证与限制见 [验收材料](reports/evidence/product-create-20261119/README.md)，生产合并/发布/验收由本机协调。
