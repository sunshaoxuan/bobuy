# Reference offer windows — local candidate

Scope: independently reviewed supplier product identity, issue associations and retained source quotation revisions. Based on `2fcedc8634bb71ad9aa576f1fcfae79763121b36`; no unverified AI candidate, real product/recommendation or production state is modified by this work.

## Rules implemented

- Item dates win. A missing boundary may inherit a campaign boundary only after explicit applicability review with original evidence text and HTTPS source link. Receipt/publication time is never used. Explicit item dates are not overwritten by campaign dates.
- Missing start remains null. The UI distinguishes a pending source search from a completed item/header/footnote search; only the latter uses `？`. Incomplete windows never automatically become active or expired. Coupon and offer periods remain distinct.
- Resolve source reference quotations only within the same product/ITEM, reviewed supplier, channel, exact variant and price unit. Future and ended windows cannot supply a current amount. Same-window different prices produce a conflict with no chosen amount; receipt recency does not resolve it. After an offer ends, another still-valid unambiguous source quote may become current; no invented fallback price.
- Legacy quotes with no structured scope remain retained/displayed as source facts, excluded from automatic current-price selection. No bulk source/date inference or backfill. No Costco quote is made into a Bobuy selling-price adjustment, and purchase/stock state is unchanged.
- New profile identity excludes issue/channel/window. Exact reviewed supplier+ITEM+variant identities can reuse existing profiles. Ambiguous existing codes require explicit normal-UI selection. Deleted codes require review and are never automatically recreated/restored. A legacy profile unlinked from its original issue can be reattached using its retained source-issue/name/specification evidence.
- Association identity no longer depends on image Hash. A new explicit window can reuse the same master and image. Upload replay remains idempotent; a changed price for the same offer requires explicit review/edit rather than silent upload replacement.
- Before explicit edits/relink/unlink, preserve the previous source snapshot; append a new snapshot on saved quotation changes. Repeat identical saves do not append duplicates; A→B→A preserves all three revisions. Existing rows are not rewritten by migration. Snapshots retain prices, raw dates, reviewed inheritance context and original image reference.
- A normal admin history button reads retained revisions through owner-checked merchant API. Anonymous/foreign access is rejected, deleted-master history is not exposed through the ordinary merchant route. Public projections exclude draft quotes and redact internal mail/supplier identity.

## Diff and migration

Runtime changes are limited to recommendation/catalog identity handling, source quotation/window model/service, source metadata controls/history UI and date display/expiry helpers. Actual ProductPricingService/ProductSaleService, inventory, payment and storage adapters are unchanged.

Prepared V23 removes `uq_recommendation_item(post_id,product_id,image_hash)`, adds nullable `offer_identity` and `reference_context`, and adds an append-only revision table. Existing nullable offer identities remain intact; new reviewed writes use a scoped offer identity under the existing merchant lock. The new uniqueness key is `(post_id,offer_identity)`. No records, images or old quote facts are deleted. Revision rows deliberately have no cascade FK to mutable/unlinked recommendation items.

The server uses a single canonical RecommendationFacts record constructor to retain Spring multipart binding compatibility. Nested reference-context multipart fields are sent as form properties; existing requests without context still bind and retain unknowns.

## Validation and remaining gates

Final executed test counts, commits and limitations are returned with the candidate receipt. Evidence files: backend `target/surefire-reports`, frontend `test-results/reference-window-browser.json`, script `frontend/scripts/verify-reference-window.mjs`.

Executed locally: 41 affected backend cases (reference windows/history/identity, recommendation HTTP, catalog, commerce, classification and synthetic SQL contract); 22 affected frontend cases; 1,209-key locale validation, TypeScript/Vite production build and common/core production packaging. Final acceptance fixes were rechecked by 14 recommendation HTTP cases; 8 reference cases passed after the optional-boolean change. No remote CI has run for this candidate.

Audit outcome remains separate from implementation: post 5 has four published groups covering nine ITEMs. The other 71 groups were not proven skipped by a cross-issue duplicate filter; execution, image validation and profile preparation were incomplete. Four exact existing active-master matches were already reused. Old image-based database uniqueness and silent quotation overwrite were real structural weaknesses corrected by this candidate. Production post 5 remains unchanged.

The browser check mounts actual React source controls/OfferInfo at 1440px and 390px mobile/touch, with synthetic fields and all real network blocked. It proves inherited campaign window, item override, checked-unknown question mark and real viewport width; it is not full production admin or API acceptance.

H2 SQL contract test checks old-row preservation and image-independent uniqueness using the actual V23 file. The first attempt found H2 lacks PostgreSQL's `timestamptz` alias; V23 now uses the equivalent standard `timestamp with time zone`. The initial H2 result alone was not a PostgreSQL/Flyway proof; the subsequent real rehearsal below supersedes that local gap. Final remote CI and production deployment remain outstanding.

## Real PG18 and normal app acceptance, 2026-11-01

The existing stopped `bobuy-local` services were reused, with three isolated synthetic databases; no production backup, image or real product data was used. Actual PG18.6 and packaged Flyway migrated a V22 fixture to V23. Every old item column fingerprint matched the pre-migration restore. Same image/new offer identity was accepted, duplicate offer identity rejected. A post-migration dump restored the retained history and validated V23; a pre-migration dump restored V22 and its old uniqueness constraint. The exact packaged SQL matched candidate source. Proof and final tested core JAR SHA256 are in `evidence/reference-offer-windows/migration-proof.json`.

Normal browser UI at localhost used the seeded synthetic agent login, not injected tokens. A single synthetic article/profile/image was reused across resumptions. UI upload, unknown start save/reopen, evidenced campaign inheritance, item override, explicit price revision/history, product-master gallery upload/save, and same-master/same-image new-window association passed. Three associations shared one product ID/hash. Published warehouse quotes with different overlapping prices returned CONFLICT/amount null; Online 999 stayed ACTIVE independently. Real 390x844 mobile/touch UI withdrew the test publication, edited notes, saved/reopened and retained old 100/90 quote revisions. Normal UI performed every business write; synthetic source URLs are test metadata, not claims of real official-image verification.

Real acceptance found and fixed two gaps: omitted nested multipart booleans could not bind to primitives (nullable binding now normalizes safely to false, ISO dates explicit); setting `published=true` before snapshot queries could auto-flush an incomplete publication row and violate the PG check (publication state now changes only after metadata/snapshots are prepared). The failed publication transaction rolled back. H2 HTTP regression and actual PG publication passed after correction. Harness-only failures (Java target, obsolete role fixture column, login destination, icon accessible name, dropdown positioning and save-response matching) are retained in the temporary acceptance logs and are not reported as product regressions.

Acceptance scripts: `frontend/scripts/verify-reference-app.mjs` and `verify-reference-mobile.mjs`. The prior isolated component harness remains separate evidence. Local service cleanup/restoration is recorded in `evidence/reference-offer-windows/cleanup-proof.json`. Do not re-run the same full suite or migration without a changed input or invalid evidence.

Production SSH `root@185.184.223.41:22` previously returned Permission denied. It has not been retried or bypassed; no new identity, credentials, network settings or production migration/deployment were attempted. The earlier denied `file:` source viewing was not retried or served through a local HTTP workaround. The synthetic UI fixture is isolated from those source files.

Rollback before new writes: stop candidate writes and restore prior app, retaining additive tables/columns and backups. After new-window/revision writes: do not run old overwrite-capable writers or blindly reinstall the old uniqueness constraint; freeze recommendation writes and use a forward-compatible corrective release, preserving new associations/history. Production release plan requires an actual PG rehearsal and explicit migration/cutover review. No destructive down migration is supplied.
