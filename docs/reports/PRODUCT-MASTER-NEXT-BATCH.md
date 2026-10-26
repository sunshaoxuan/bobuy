# Product-master and temporary-price follow-up boundary

This is an investigation handoff, not implemented/delivered functionality. Keep this work outside the frozen 20261026.6 registration/gallery/title batch. No real product content has been changed by engineering.

Latest parent UI evidence: 152 recommendations now link to 142 private, unpriced product profiles, with ten explicit same-specification cross-issue reuses. Do not repeat backfill or reset their state. Deployment preservation uses the latest actual snapshot, not the historical zero-product baseline.

## Existing / missing

Product already owns multilingual `name`/`description`, item number, brand, media gallery, primary category, attributes, storage/order method, private visibility, record version, currency and an operator-reviewed sale JSON. StockMaster is the existing product editor/list and bulk onboarding surface. RecommendationCatalog provides visible missing-profile creation and explicit existing-profile linking.

However, RecommendationItem still separately owns editable name/specification/description/translations, category IDs, supplier and official gallery. RecommendationCatalogService creates a private profile and copies available name/description/media; later synchronization is conditional on the profile's originating issue. This is a link/copy design, not the requested canonical product-master projection. Product has no complete dedicated source-language/specification/multi-category/supplier metadata workflow comparable to recommendations. Do not assert that 142 linked IDs means every product field/image/source is complete. Parent is independently checking actual field completeness through normal UI.

ProductSaleService currently stores one ProductSale JSON (amount/currency/unit/inclusive Japan dates/revision/reviewer/enabled) on Product, independently of Costco reference amounts. quote() returns unavailable outside that period; it does not resolve an independent scheduled adjustment entity and return to a regular selling price. Existing source reference offer facts must stay separate from future actual sales adjustments.

## Next authorized bounded implementation

Reuse Product and StockMaster. Add the missing metadata/editor/bulk preview-confirm path with optimistic versions and explicit conflict handling, retaining all legacy evidence. Recommendation cards/detail and cart text should project canonical reviewed product metadata; per-issue/source/channel offer prices, periods and conditions remain on recommendation occurrences. Existing canonical product data must not be silently overwritten on import or same-ITEM matching. Different packaging/model and warehouse/online quotations require separate identity/offer handling; no fuzzy same-name merge.

Add a persistent price-adjustment entity keyed by product/variant (when applicable), channel and currency, retaining regular selling price separately. Use explicit JST intervals, block overlapping scheduled/active adjustments with visible conflicts, and resolve effective prices server-side for both display and checkout. Keep order unit-price snapshots immutable and revalidate checkout changes. No reference amount or zero placeholder may activate sale; all current products remain private/unpriced until a normal UI business confirmation. No real data backfill from SQL/scripts/hidden endpoints.

No schema, master-content migration, price adjustment, pricing confirmation or purchase activation for this next batch has been run. The Postmaster verification-mail flow is tracked separately in SELF-REGISTRATION-CUSTOMER-ONLY.md and must not delay delivery of the already tested urgent boundary fix.
