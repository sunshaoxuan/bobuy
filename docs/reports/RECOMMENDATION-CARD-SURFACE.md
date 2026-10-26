# Recommendation card surface and pointer feedback

Scope: card appearance/feedback only. No real content, price, inventory, purchase rule or translation configuration changes.

## Confirmed cause

`product-feed.css` retains an old bottom overlay `linear-gradient(180deg,transparent,...rgba(0,0,0,.18))`. Commit 93394f7 added `.storefront .product-tile::after` / `.rec-pin .product-body::before {display:none}` in browse.css, removing that layer while moving captions away from images. Commit c3dd2b2 then made product-tile/product-photo backgrounds transparent and removed photo padding/border. Actual published DOM before this candidate reports no card background/shadow/padding/border, while img/photo still have 20px CSS radius. Thus white official product photos blend into the white page; image-file corners were not lost.

## Minimal change

The recommendation card gets a restrained bottom-gray-to-transparent background, 10px desktop/8px mobile padding, 1px fine border, shallow shadow and 24px/20px outer rounding. Photo natural ratio/direct CSS rounding stay intact. Caption background becomes transparent so the container gradient remains visible. Important muted code/status text is slightly darker for contrast. No overlay is placed above product pixels, and no image bytes are modified.

Hover changes only the shadow, gated by `(hover:hover) and (pointer:fine)`; the old photo zoom is suppressed for recommendation cards. Keyboard focus is outlined; reduced motion removes shadow transition. Chromium touch probes showed native `:active` did not expose held feedback, so a minimal pointer-state marker handles touch/pen and clears on release/cancel/leave/lost capture/window blur. No preventDefault/stopPropagation or scrolling override is used. Existing links, detail/multi-image and language behavior remain.

## Acceptance / release

Candidate build PASS. Actual candidate frontend in the existing shared local web container uses read-only replay of real published GET data/images. White-background image pixels are sampled to prove actual official white photos are in the check. Desktop/mobile border/gradient/radius, hover without zoom, keyboard detail activation, gallery switching, touch hold/release with no sticky hover, normal native scrolling and reduced-motion all PASS with zero page errors/business writes. Early CSS-only touch diagnostics are retained as diagnosis; final pointer behavior is verified in the candidate implementation.

Normal exact-head CI, production image/backup/content checks and live visual verification are pending. Reuse five unchanged .4 Java image IDs; build only the frontend image for .5. Preserve the current latest data snapshot, not earlier unimported content fingerprints. Evidence: `evidence/recommendation-card-surface/`.
