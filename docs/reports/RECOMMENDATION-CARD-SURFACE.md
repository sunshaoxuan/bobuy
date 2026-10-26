# Recommendation card surface and pointer feedback

Scope: card appearance/feedback only. No real content, price, inventory, purchase rule or translation configuration changes.

## Confirmed cause

`product-feed.css` retains an old bottom overlay `linear-gradient(180deg,transparent,...rgba(0,0,0,.18))`. Commit 93394f7 added `.storefront .product-tile::after` / `.rec-pin .product-body::before {display:none}` in browse.css, removing that layer while moving captions away from images. Commit c3dd2b2 then made product-tile/product-photo backgrounds transparent and removed photo padding/border. Actual published DOM before this candidate reports no card background/shadow/padding/border, while img/photo still have 20px CSS radius. Thus white official product photos blend into the white page; image-file corners were not lost.

## Minimal change

The recommendation card gets a restrained bottom-gray-to-transparent background, 10px desktop/8px mobile padding, 1px fine border, shallow shadow and 24px/20px outer rounding. Photo natural ratio/direct CSS rounding stay intact. Caption background becomes transparent so the container gradient remains visible. Important muted code/status text is slightly darker for contrast. No overlay is placed above product pixels, and no image bytes are modified.

Hover changes only the shadow, gated by `(hover:hover) and (pointer:fine)`; the old photo zoom is suppressed for recommendation cards. Keyboard focus is outlined; reduced motion removes shadow transition. Chromium touch probes showed native `:active` did not expose held feedback, so a minimal pointer-state marker handles touch/pen and clears on release/cancel/leave/lost capture/window blur. No preventDefault/stopPropagation or scrolling override is used. Existing links, detail/multi-image and language behavior remain.

## Acceptance / release

Candidate build PASS. Actual candidate frontend in the existing shared local web container uses read-only replay of real published GET data/images. White-background image pixels are sampled to prove actual official white photos are in the check. Desktop/mobile border/gradient/radius, hover without zoom, keyboard detail activation, gallery switching, touch hold/release with no sticky hover, normal native scrolling and reduced-motion all PASS with zero page errors/business writes. Early CSS-only touch diagnostics are retained as diagnosis; final pointer behavior is verified in the candidate implementation.

Released as **20261026.5**, application source `7b743797ce3976c8716166e8b9eb29665f95b524`. Exact-head CI [40364441989](https://github.com/sunshaoxuan/bobuy/actions/runs/40364441989) and CodeQL [40364441968](https://github.com/sunshaoxuan/bobuy/actions/runs/40364441968) passed. Backend: 206 tests, zero failures/errors, two skipped. Frontend: 106 tests across 33 files. Coverage: 583/622 lines (93.7299%) and 187/233 branches (80.2575%); existing 90%/70% thresholds unchanged.

Only the frontend image was built; five Java images were reused after verifying their previous binding/image IDs and unchanged Java source. Source archive SHA256: `de2bef78334ee224d3890966f2b4dbac021024f0df70ff0f6a19212288a850ad`. Normal publisher activation completed, five application services are healthy, frontend is running, and all restart counts are zero. Database restore/schema-history and object archive checks passed; recoverable backup is `/opt/bobuy/releases/20261026.5/backup`.

All seven frozen content-table projections match the latest pre-deployment snapshot exactly: both posts remain published, with 122 and 30 items, 121 and 30 classified respectively, all suppliers hidden, 566 image blobs and zero product records. Protected runtime settings and migration history are unchanged. This task made no real content or image writes.

Actual deployed desktop/mobile screenshots were visually reviewed: white official photos retain natural proportions and CSS rounding, fine card edges remain visible, and the gradient sits behind the image/text. Live hover, keyboard focus/detail activation/gallery, reduced motion, touch hold/release and native scroll checks passed with no page errors or business writes. Deployed HTML/CSS/JS bytes match the accepted frontend build. One initial release assertion sampled the shadow before its transition settled; the retained timing failure was resolved by waiting for the cleared pointer marker and exact settled base shadow within 1500ms. No application change or repeat deployment was needed.

Visual evidence: `evidence/recommendation-card-surface/` (including original diagnosis/timing records and final `live-browser.json`). CI, image bindings, restore and frozen-content receipts: `evidence/recommendation-card-surface-production/`. No remaining blocker for this scoped repair.
