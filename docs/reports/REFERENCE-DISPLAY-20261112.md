# Reference price display, 2026-11-12

## Goal and authorized batch

Continue the authorized production UI work from main ecf1d09. Reproduce No.77839. Remove repeated specification above price, source-issue links, reference provenance/status rows and mail conditions from consumer detail. Keep genuine product description. Show one warehouse reference price with Online as small annotation when both exist. After an inclusive offer ending in Asia/Tokyo, restore known original and hide discounts. Preserve top No. pill, compact native-name line, right-aligned price/unit and silent gray unrated stars.

## Method and scope

Investigate read projections and real public source facts, get advanced text advisory, implement equivalent explicit price-display policies in Java and TypeScript. No historical fact rewrite, migration, checkout price change, account feature or unrelated dirty file integration. Unknown original remains unknown. Selection must stay within the same explicit product identity. Reuse the running local stack and isolated worktree.

## Acceptance and validation

Warehouse wins over Online, deterministic newest source within channel. Verify Japan midnight, inclusive end, upcoming period, partial/unknown/contradictory dates, absent original and ordinary prices. Catalogue and recommendation detail/card must agree on expiry. No.77839 must show one main warehouse original price and smaller Online original annotation after expiry, with no discount or removed metadata. Test longest names/units/numbers, Japanese and translated names, desktop and 360px mobile, navigation/close/booking behavior, console and network. Run affected tests and mandatory release gates on frozen source once. Browser screenshots precede visual judgment and Gemini review.

Before implementation visual budgets: 20px page gutter desktop, 12px minimum mobile; one information column on mobile and balanced media/info columns desktop; 16px main section spacing; native name directly below title. No pill glyph padding below 3px; visual center error at most min(2px, glyph height * 0.1). Existing main mobile controls remain at least 44px high, adjacent interaction regions at least 6px apart. Price and unit share right edge. Online annotation wraps safely without another price card. Capture whole page and native-size changed-area crop.

## Release and recovery

Pin source, image digests, current production base, exact gates and scoped operator. If core changes, preserve schema V32 and business fingerprints, take fresh guarded backup and use application-only rollback after writers reopen. Replace only scoped core/frontend services. Verify actual production hashes, health, source data invariance and affected pages. Record final matrix and remaining limitations before delivery; clean only this task's transient outputs.

## Evidence

Pending implementation and validation. Initial investigation: source occurrences each render DetailOffer and source headings; expired state is displayed alongside raw discounted referencePrice. Backend catalogue takes first reference source. Existing catalogue revision already includes the Japan calendar day and frontend has a midnight rollover hook.

## Integration checkpoint

2026-11-12 08:16 JST: concurrent authorized engagement release 20261112.3 is activating ebea743. Its changes add price/rating/popularity sorting, click heat and rating controls, plus V33. This task must preserve those deployed features. Merge that exact commit before a new activation, verify its runtime completion and actual V33 baseline. The only merge conflict is the browse revision/clock block; preserve both sort inputs and one captured Japan-day clock, and use effective display prices for sorting. Earlier backend full gate (663 tests, zero failures, 24 conditional skips, actual fresh JaCoCo check PASS) describes the pre-integration tree. New Java browse inputs invalidate that tree's final full gate; run one full merged backend gate and union frontend regression. Earlier browser retry was invalidated by actual production maintenance HTTP503, with zero final screenshots accepted from that run. Preserve historical/source data and do not rerun migrations in this task.

External advisory: Claude opus request returned no available accounts; DeepSeek exact deepseek-flash/high advised explicit identity, deterministic channel selection, date boundaries and stale async-result protection. Gemini Pro image attempt returned upstream_error; Gemini 3.8 Flash high successfully identified both prices. Final visual review follows final running screenshots.

Final review corrected one over-restrictive identity predicate: an explicitly linked product UUID with both item numbers absent must retain its known reference price. Item numbers still compare exactly whenever present, preserving zero prefixes and rejecting cross-item rows. This changes the Java and TypeScript selection input, so the former full backend gate is no longer the final price-policy gate. Run the affected selection regression first, then one final mandatory full backend gate with fresh coverage data; reuse unrelated account, maintenance and unchanged screenshot geometry evidence. No source fact, layout, date policy or checkout behavior changes in this correction.
