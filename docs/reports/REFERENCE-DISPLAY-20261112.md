# Reference price display, 2026-11-12

## Goal and authorized batch

Continue the authorized production UI work from main ecf1d09. Reproduce No.77839. Remove repeated specification above price, source-issue links, reference provenance/status rows and mail conditions from consumer detail. Keep genuine product description. Show one warehouse reference price with Online as small annotation when both exist. After an inclusive offer ending in Asia/Tokyo, restore known original and hide discounts. Preserve top No. pill, compact native-name line, right-aligned price/unit and silent gray unrated stars.

## Method and scope

Investigate read projections and real public source facts, get advanced text advisory, implement equivalent explicit price-display policies in Java and TypeScript. No historical fact rewrite, migration, checkout price change, account feature or unrelated dirty file integration. Unknown original remains unknown. Selection must stay within the same explicit product identity. Reuse the running local stack and isolated worktree.

## Acceptance and validation

Warehouse wins over Online, deterministic newest source within channel. Verify Japan midnight, inclusive end, upcoming period, partial/unknown/contradictory dates, absent original and ordinary prices. Catalogue and recommendation detail/card must agree on expiry. No.77839 must show one main warehouse original price and smaller Online original annotation after expiry, with no discount or removed metadata. Test longest names/units/numbers, Japanese and translated names, desktop and 360px mobile, navigation/close/booking behavior, console and network. Run affected tests and mandatory release gates on frozen source once. Browser screenshots precede visual judgment and Gemini review.

Before implementation visual budgets: 20px page gutter desktop, 12px minimum mobile; one information column on mobile and balanced media/info columns desktop; 16px main section spacing; native name directly below title. No pill glyph padding below 3px; visual center error at most min(2px, glyph height * 0.1). Existing main mobile controls remain at least 44px high, adjacent interaction regions at least 6px apart. Price and unit share right edge. Online annotation wraps safely without another price card. Capture whole page and native-size changed-area crop.

## Release and recovery

Pin source, image digests, current production base, exact gates and scoped operator. Preserve the actual V33 schema and business fingerprints, take fresh guarded backups and use application-only rollback after writers reopen. Replace only scoped core/frontend services. Verify actual production hashes, health, source data invariance and affected pages. Record final matrix and remaining limitations before delivery; clean only this task's transient outputs.

## Evidence

Initial investigation: source occurrences each rendered DetailOffer and source headings; expired state was displayed alongside raw discounted referencePrice. Backend catalogue took the first reference source. Existing catalogue revision already included the Japan calendar day and frontend had a midnight rollover hook. Implementation and final production validation are complete; detailed evidence is linked below.

## Integration checkpoint

2026-11-12 08:16 JST: concurrent authorized engagement release 20261112.3 is activating ebea743. Its changes add price/rating/popularity sorting, click heat and rating controls, plus V33. This task must preserve those deployed features. Merge that exact commit before a new activation, verify its runtime completion and actual V33 baseline. The only merge conflict is the browse revision/clock block; preserve both sort inputs and one captured Japan-day clock, and use effective display prices for sorting. Earlier backend full gate (663 tests, zero failures, 24 conditional skips, actual fresh JaCoCo check PASS) describes the pre-integration tree. New Java browse inputs invalidate that tree's final full gate; run one full merged backend gate and union frontend regression. Earlier browser retry was invalidated by actual production maintenance HTTP503, with zero final screenshots accepted from that run. Preserve historical/source data and do not rerun migrations in this task.

External advisory: Claude opus request returned no available accounts; DeepSeek exact deepseek-flash/high advised explicit identity, deterministic channel selection, date boundaries and stale async-result protection. Gemini Pro image attempt returned upstream_error; Gemini 3.8 Flash high successfully identified both prices. Final visual review follows final running screenshots.

Final review corrected one over-restrictive identity predicate: an explicitly linked product UUID with both item numbers absent must retain its known reference price. Item numbers still compare exactly whenever present, preserving zero prefixes and rejecting cross-item rows. This changes the Java and TypeScript selection input, so the former full backend gate is no longer the final price-policy gate. Run the affected selection regression first, then one final mandatory full backend gate with fresh coverage data; reuse unrelated account, maintenance and unchanged screenshot geometry evidence. No source fact, layout, date policy or checkout behavior changes in this correction.

## Bounded integration repair after activation

Release reference-display.4 restored reference prices and preserved schema/content. Final cross-column review found that the separately released recommendation price sort still used raw historical discount amounts. Overall price consistency acceptance remains incomplete until this is repaired. Use the same ReferencePriceDisplay policy for recommendation sorting with the captured Japan day; actual merchant quotes retain priority, unknown prices remain last, source DTO facts stay historical and unchanged. Add ascending/descending, future/expired/unknown and actual-sale regression. This is necessary to preserve the already published sort feature under the new expiry requirement. Only core changes; reuse the accepted frontend bytes, 24 production visual states and price/date evidence. New backend input invalidates the core gate only: run focused sort tests, then one required full backend/coverage gate and exact-source CodeQL. Deploy core only with the same protected-data and application rollback guards.

## Final acceptance, 2026-11-12

Frontend deac521 activated at 08:46:45 JST; final core a14f032 activated at 08:58:04 JST. The core-only follow-up preserves the complete frontend container and hashes. Published account, maintenance wording, sorting, heat and rating features are preserved. Main merges add no further application inputs.

| Requirement | Result | Evidence |
| --- | --- | --- |
| Remove repeated specification, source issue/provenance and mail condition blocks; preserve genuine introduction | PASS | 24 production catalog/recommendation detail states and native crops |
| Warehouse primary, Online smaller annotation, single price card | PASS | No.77839 main1498 and Online1828, price-acceptance.json |
| Inclusive Japan ending restores original and removes discounts, including open detail | PASS | production-midnight.json, explicit synthetic browser clock with real facts |
| Active discount, long names/units/amounts, native-name ellipsis and missing original | PASS | source tests and explicitly synthetic boundary screenshots |
| Price sorting uses the displayed price, retaining actual sale priority | PASS | focused21, final backend666, eight before inversions reduced to zero in four real browser cases |
| Function, console/network, responsive layout, glyph safety and visual review | PASS | production-matrix.json, two 48-region glyph reports, independent Gemini review and main-agent findings |
| Data, schema, artifacts and executable application rollback | PASS | both activations preserve content and migration fingerprints; fresh backups;34 Flyway checksums; final healthy runtime and zero restart counts |

Final backend gate: 666 reported,642 executed,24 conditional skips, zero failures/errors and actual configured JaCoCo PASS. Frontend relevant union111 plus account21 and maintenance6 compatibility scopes are separately recorded. CodeQL exact-source runs43121206595 and43122734879 passed. Historical facts and actual checkout quotes are unchanged. Unknown originals remain unknown, and no product introduction was fabricated. [Evidence and precise source bindings](evidence/reference-display-20261112/README.md).
