# Product master review workflow

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
