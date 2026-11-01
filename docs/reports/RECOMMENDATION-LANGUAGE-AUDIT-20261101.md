# Recommendation language audit: production observation

Read-only normal Edge UI at `https://bobuy.cc/recommendations/5`, 2026-11-01. No production content was edited. The original Simplified Chinese selection was restored after checks.

- Simplified Chinese was visibly selected. The issue title and product translated names/specifications were Chinese, with the required Japanese original names retained separately.
- Expanding the article exposed two Japanese paragraphs (starting `Costco倉庫店` and `生鮮は100g当たり`), followed by a Simplified Chinese paragraph and the official source URL. This is actual mixed-language article content, not just Japanese product-name parentheses.
- Switching to Traditional Chinese, English and Japanese changed navigation, product names/specifications and UI labels. The article title and entire mixed-language body stayed the same across all four selections. This isolates the article problem from locale selection/cache. No full audit of all issue bodies or all product descriptions is claimed.

Code evidence: `RecommendationPost` contains only one `title` and one `body` string. `RecommendationService.Detail` returns the same body for all locales. `PublicRecommendations.tsx` directly excerpts/renders `detail.body`; it does not select a translated article body. `i18n.tsx` uses `bobbuy_locale`, default zh-CN. UI translation and product translation do not translate the article.

There is a separate field-level risk in `recommendationText.ts`: specification, description and offerNotes use `translatedField || JapaneseSourceField`, but `missing` only tests translated name availability. A translated name with missing description can therefore silently fall back to Japanese description without a missing-description notice. This is confirmed from code; a specific production description occurrence has not yet been established. Preserve Japanese names and source fields.

Minimum corrective scope for a separate bounded follow-up: additive per-locale article title/body with retained original source and review/source-version state, normal editor language fields, selected-locale article rendering and explicit untranslated/source-language presentation. Product body fields need field-level missing-translation status and clearly labeled source text rather than silent fallback. Actual missing translations must be reviewed/saved through the normal UI, preserving source Japanese and user edits. Do not infer a source locale for mixed legacy bodies, bulk overwrite them, hide the introduction, or claim the unverified AI translation connection works.

Status: root cause and affected data shape established; no language data/model/rendering fix or production translation has been applied in the V23 acceptance batch.
