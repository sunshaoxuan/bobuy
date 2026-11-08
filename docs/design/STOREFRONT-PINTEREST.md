# Client navigation and visual acceptance

## R4 independently accepted locally; production preparation only

[Final acceptance and requirement/release binding](../reports/CONSUMER-UI-20261108-ACCEPTANCE.md) supersedes the pending statuses below. Independent R4 closed D2/D3/D4; 12 PASS, zero FAIL, actual speech accepted nonblocking NOT_RUN. The 33 accepted application inputs remain unchanged; new committed CI and production artifact QA are separate gates. No production activation in this phase.

## R4 actual viewport return — independent narrow recheck pending

Product detail must return to the originating browse viewport and visible control. Retain its background list/header while the detail URL carries topic+item; close restores the original topic context (remove only detail-introduced topic, retain explicit issue/deep-link context) with node/query/category intact. Obscured directory remains hidden/unfocusable without removing its layout height. Capture actual pre-open scroll and restore it only for the same-scope original/rebuilt control, then prevent focus scrolling; fallback/new scope/action/deadline cannot apply an old snapshot. No forced centering or data preload.

[R4 measured cause and exact final evidence](../reports/CONSUMER-UI-20261108-R4.md): all six genuine prior failures reproduced and now0px pre/post delta with same visible rectangles on final index `8ded1639926a162b7cb1fbaac3cd3eeba5b95743517302e6c7b0da5084c0a8c4`, source `54df7134207712abc391ecfd5f6ecdb8fe3548381035e2b7293332a4b6fbda0d`. Independent R3 FAIL remains until original QA's narrow dev4 judgment. Actual speech NOT_RUN stays accepted non-blocking; no new settings/reader/production/commit/push action. Earlier reports/failures retained.

## R3 return-focus correction — independent narrow recheck pending

Recommendation detail is route-conditionally unmounted, so the stable page/preview owner now retains the actual initiating control and logical post/item/control kind. Restore the original or rebuilt same-card target after close/Escape/history; otherwise use a current visible detail control or heading without scrolling. Wait at most500ms for ready DOM, cancel on new interaction/scope/unmount and never let a late result steal focus. Add no fetch/traversal and preserve URL, page state and gallery's separate fullscreen→inline restoration.

[Dev3 report and replay](../reports/CONSUMER-UI-20261108-R3.md) binds source `ac23f30c77adab4d4e67ef12b07b4e44d88b8ce13eef35a0d0b0ffc93c93f0b4`, actual local index `a2b2e87c8339f4324c0a44394fd302da6f78ca8241eb5eacf25f10694061b119`; backend/publisher/data remain unchanged. Original independent R2 return-focus FAIL stays until dev3 QA. Actual speech remainsNOT_RUN, accepted by PM as a non-blocking validation limitation per parent relay; four-language keyboard/ARIA/AX evidence retained without speech claim or settings changes. No commit/push/production operation.

## QA correction handoff — 2026-11-08 dev2, not accepted/released

Independent dev1 QA found two P2: underway browse context was incorrectly enough to expose root plus with no bookable trip, and legacy product-add CSS overrode the dark background while retaining white SVG. Dev2 minimally uses already-loaded same-owner bookable trips plus resolved state/live actual quote and callback guards, preserving root eligibility/quantity behavior; it scopes plus CSS to `.storefront .product-add.reservation-add` with visible separated focus outline. Actual44px computed icon/background contrast over white>=7.09:1; no new preload, authority or trade flow.

See [R2 source/artifact/test report](../reports/CONSUMER-UI-20261108-R2.md). Source digest `ef738953ce56778a235a1f437d9faf6f8b61d496f4b1499ff10408738ef7e58f`; local index `1989e08d92309fd7b7d9db4fe6ee92f8af4fdf32e3df4941d8d38a32126d54df`, backend/publisher unchanged. Last independent7PASS/1FAIL/5NOT_RUN remains historical fact; developer fixes do not close QA. Prepared [missing-case inputs and steps](../../frontend/test-results/consumer-ui-20261108/r2/QA-REPLAY-GUIDE.md), retaining D2/D4/D5/D8/D10 and actual-reader uncertainty. D6/D13 retain accepted mock/service boundaries without new real-login/clear-database requirements. No production/commit/push; original artifacts and records below remain.

## Implementation handoff — 2026-11-08 consumer-ui-20261108-dev1

All seven scoped UI changes are implemented and developer-tested in the sole root; independent QA and release remain pending. This latest implementation status supersedes the earlier design-time “not implemented” status below, preserving that planning history. Original PM D1–D13 remain mandatory. See [implementation, exact source/artifact bindings, test limits and QA matrix](../reports/CONSUMER-UI-20261108.md) and [source manifest](../../frontend/test-results/consumer-ui-20261108/SOURCE-MANIFEST.json).

The zero-marked visibility signal is the same response's `markedScopeTotal` before query/category/pagination, not search-filtered `scopeTotal`. Missing/loading/error never means zero. A hidden public section retains its data owner and independent detail; all-card same-merchant edit access remains. The issue rail requires both >=1280 viewport and >=1060 content room, reserves300px, and loads only one20-row metadata page after primary cards are usable (narrow: explicit open). Mobile native swipe preserves `touch-action:pan-y` with a scoped selector; no source image bytes or gesture algorithm changed. Consumer provenance presentation and alt are removed/adapted without altering internal evidence. Current merchant names and publication-time signatures retain different semantics. The eligible-only44px plus uses existing real quote/trip/action guards, and detail shows one unavailable explanation.

Final local JAR SHA `1ac5d916ca78498e04ffaad0338af38505fde17c455f991cc34aeb8c6cc84a5b`; web index SHA `7b4bea9086e55ead93a7da79553e50dfd2245f1d61f22d0d963a75655141c4b3`. No new commit/release, production operation, persisted test-data import or real order. All original design/failed test/release records remain.

## Latest user contract — 2026-11-08 consumer UI batch (design only)

This section supersedes older public image-source-link presentation requirements, not provenance retention. The detailed Chinese requirements, source evidence and D1–D11 NOT_RUN matrix are in the original [PM plan](../../../pm-20261106/PLAN.md). Current production is separately accepted `20261107.1 / fc57d58e`; none of this new batch is implemented or released. Original failure/recovery evidence remains intact. PM inspected both Library version0 images locally on OHR0067: detail `libfile_0c363945d0e0819195fcabc9e3dc97b8` SHA `1f041fff6d71b1da86f248ea03191a7e28c8a4bbcf3a6fda71b12505bdda4ed1`, directory `libfile_33433530a28c81919a5a086c4b3ad512` SHA `b3f90e44c2d2a7562fc11aa4741185623ca432d5ed68fefce8150056dc0d9451`.

- Detail: retain the Drawer and existing gallery, desktop media/information columns when viewport at least960px and space permits (up to1120px), narrower single natural scrolling column, mobile18–20px padding. Group brand, full localized/Japanese name, identity/spec, actual sale price vs clearly labelled reference offer, dates/conditions, description and existing purchase action. Use existing typography, natural image ratios,16–20px rounding, pale groups and whitespace. No title clamp, image crop/alteration, nested column scrolling or new brand system. Existing gestures/keyboard/fullscreen/native-size/pan/focus/URL/list context behavior stays.
- Public image attribution: remove the source details/links/filenames from customer JSX and consumer preview, including filename-derived consumer alt text; no CSS-hidden focusable leftovers. Keep internal audit forms and sourceUrl/assetKey/hash/original files/gallery associations/history byte-for-byte. Preserve image-embedded text/watermarks/prices, language-fallback notices and reference-issue factual links. Shared viewer presentation changes must keep internal labels and stable pictures identity.
- Reference offers always say non-selling price near the amount; real sale price is separate. All important dates, units, channel differences, tax/quantity/coupon restrictions and unknown/expired/conflicting states remain clear. Unparsed offerNotes stays in a default-open conditions group; only noncritical long description may collapse. Missing valid actual quote or matching bookable trip keeps existing disabled purchase rules. No invented fields or production content changes.
- Issue directory means recommendation publication links, not the global sidebar. At>=1280px with enough space use a clearly labelled sticky upper-right icon group in a reserved300–340px aside below the main header; at most4 recognizable recent/selected issues plus more. Hover/focus opens complete wrapping titles leftward within that space; leave only collapses when focus is outside, retaining label/current clues. Click-pinned toggle supports no-hover/touch, Escape closes with return-focus and reopen suppression; semantic nav/links,aria-current and full accessible names,44px targets,reduced motion. Real dates/counts retained, service/unknown states truthful. Bounded scroll/manual20-row paging for many issues. Under1280px or insufficient room use an always-visible labelled in-flow disclosure, not a mobile floating obstruction. Details/lightbox owns focus and overlays above directory.
- Desktop first cards must become usable without waiting for directory. Only after primary first-page readiness fetch one20-row metadata page; no all-issue products/bodies/gallery/quotes or automatic history loading. Stable directory data owner survives hover/close; manual more fetches next page. Narrow screens may defer metadata until explicit click. Preserve exact revision/dataset/409 gates,selected issue state,node/query/category and intentional item clearing on issue choice. Update the old zero-directory-request test to distinguish before-first-card from the new bounded post-ready metadata request; do not claim a cache not present in source.
- Home: remove the three duplicate links from brand intro; preserve existing primary desktop/mobile navigation and fc57 actual-homePath selection. Update generated initial home HTML to one corresponding crawlable semantic nav with the three destinations, plus truthful brand/H1/metadata/canonical/JSON-LD. Do not merely hide links with CSS.
- Current merchant name: existing publicNodes eligibility IDs only, batch-resolve current User.name, no all-users enumeration/scope expansion. Current node/trip labels agree; retain publisherName/publisherId/merchantId snapshots and attribution history, explicitly label publication-time signature if shown. No rename/republication/tenant/permission/data rewrite.

Implementation remains serial in the sole `.task-tmp/media-upload-fix` root: existing continuation handles detail/source, directory, home and current-name delta, releases write/test ownership, independent QA verifies exact final source/runtime and D1–D11, original publisher handles required exact-head CI and controlled release/readback. No PM code/tests/services/browser/production execution; no second stack/copy. New batch receives its own version/change/evidence record.


The client follows Pinterest's image-first browsing direction while retaining the
Bobuy brand. This is an overall visual requirement, not merely a category-chip
interaction. Do not revert to a crowded header or heavy decorative typography.

## Home and mobile shortcuts (2026-10-29)

After successful initial loading, the bare home route shows trip finds when the
current node has an upcoming published trip (delivery date today or later) or
an IN_PROGRESS trip, including a trip still underway after its delivery date.
Otherwise replace it with recommendations, preserving query context. The existing
model has a delivery date and operational status, not a separate start timestamp.
Stock, sellable-product counts and capacity do not determine display eligibility.
Completed/settled trips stay in history. The opt-in `includeCurrent=true` public
trip projection returns only the existing public summary fields. Ordinary trip
queries, new-booking checks and checkout remain bookable-only; do not turn an
in-progress browsing context into permission for a new booking.
An API failure must remain an error rather than being treated as an empty result.
The explicit `/products` route always opens trip finds, including its empty state.
Explicit recommendation, item, cart, account and checkout links are never subject
to home redirection, including after authentication or browser history traversal.

Product Picks precedes Trip finds in the main navigation. Only below the existing
768px breakpoint, show four bottom shortcuts: Product Picks, Trip finds, Cart and
My account. Preserve node context, accessible current state, at least 44px touch
targets, keyboard focus, safe-area spacing and sufficient page-bottom padding.
Keep desktop layout without the mobile bar. Image lightboxes and drawers appear
above it and retain their existing gestures, focus and draft state.

- Desktop: visible left navigation and node selector in one context. Discover,
  bookable trips, executed trips and product picks have clear labels and one
  selected state. Existing customer orders/bills retain their authorization.
- Mobile: a labelled menu button opens a partial-width dismissible drawer.
  Navigating closes it; it must not permanently occupy the content viewport.
- Use one locale-aware sans-serif stack for Latin, Japanese and Chinese, regular
  body weight, 14–16 px readable content and restrained 22–28 px page headings.
  Buttons retain at least 44 px touch targets. No faux serif/stroked overlays.
- Products: natural image proportions, adaptive masonry, rounded images, white
  space and captions below images. Official price text inside source images must
  not be cropped. JPY source prices and date/unit/coupon facts remain legible and
  distinct from any separately reviewed actual selling price.
- Category chips remain prominent and horizontally scrollable; All remains
  available. Multi-category products are not duplicated. Empty/stale categories,
  repeated clicks and browser back must work.
- Trips use structured cards with destination, date, node and action. Do not
  force itinerary information into a photo grid.
- URL `node` is a browsing filter, never an authentication/tenant override.
  Public filters only narrow already-public data. Customer history/orders/bills
  use the existing authorized endpoints and filter their returned trip owner.
  Clear stale node results, ignore late responses and preserve context on
  navigation, refresh and browser history. Unknown nodes must not fall back to
  unrelated data. Preserve the existing cross-merchant cart confirmation.
- Draft preview must use the same customer issue/card/filter components. Keep
  preview local/private; no public draft route, publication or real order is
  needed for visual acceptance. Test desktop and 390 px preview with products;
  an empty public feed alone is insufficient.

Before release, inspect actual desktop/mobile screenshots of navigation, a
populated recommendation preview, filters, itinerary cards and empty/loading
states. Check overflow, source-image framing, typography, keyboard focus,
selected navigation, drawer closure, back/forward/refresh and node races. Run
affected tests; exact-head CI supplies the complete required gates once.

User references supplied for this revision: Library
libfile_176c2f7d8b7c8191a1fe4448b3a9598e and
libfile_5f493caa77e48191babbf4d05fbaeb88. The unmodified Library materializer failed
on Windows (`os.setxattr` unavailable), then succeeded in the host's existing
Ubuntu runtime, preserving full file metadata. Both images were inspected locally.
The first shows the squeezed two-line recommendation header link. The second
shows a narrow left rail, a large filled round search field, naturally proportioned
rounded images, restrained typography and generous space between staggered cards.
Bobuy uses text-labelled navigation for its itinerary tasks rather than copying
Pinterest icons or branding. Compare actual populated desktop/mobile screenshots
against those properties before accepting the release.

Catalog safety: recommendations retain per-issue source quotations. Newly
registered profiles are private/unpriced and use real product IDs, not stock
placeholders. Reviewed reuse must not rewrite existing price, quantities or
metadata. No same-name or same-code merging across source issues without human
selection. Repeated registration/link retries must be idempotent. Product
creation does not publish a recommendation or imply stock availability.


## Product detail/content acceptance added in 20261026.4

Cards contain localized name (Japanese suffix outside ja-JP), original string code, concise specification, source/actual price distinction and critical inclusive Japan offer/coupon periods. Full descriptions and complete conditions belong to addressable structured item detail, preserving filters/list position on back. Missing/stale translation falls back explicitly to Japanese. Currency code/symbol/digits never follow UI language.

Only exact verified official product galleries supply covers. Promotion posters remain internal source evidence; never erase prices or redraw them to fake official photography. Missing/reliable-match-pending images use a clear placeholder. Ordered thumbnail galleries support distinct angles/details; canonical asset identities/hash reuse deduplicate resized copies. Image elements themselves use border-radius with clipped containers and natural aspect ratio; do not simulate corners with artwork/background masks or crop important product content. Test portrait/square/transparent/wide ratios at desktop and narrow widths. Published real-gallery visual acceptance follows normal content import and must not be inferred from an empty public page or synthetic-only evidence.


## White-photo card surface and interaction

Keep a subtle gray-at-bottom to transparent/white-at-top gradient on the recommendation **card container**, with restrained padding, a fine border and shallow shadow. White official photos must have a distinguishable rounded edge without altering image files, tinting pixels or putting a broad dark overlay above them. Image CSS rounding and natural ratio remain intact. Name/specification/price/period text stays legible over the pale surface.

Use one small shadow response: hover only for hover-capable fine pointers; touch/pen hold uses a transient pointer marker, cleared on release/cancel/leave/lost capture/window blur. Never prevent default scrolling or stop existing button events. Preserve a visible keyboard focus outline and remove transition under reduced-motion preference. Disable the old recommendation-photo hover scale so effects do not stack. Acceptance includes real white official product images at desktop/mobile, touch press/release/native scroll, keyboard detail activation, multi-image detail and reduced motion.

## Recommendation image gestures and name lines

Detail images are a gallery, not a hover-preview target. Inline horizontal swipes navigate and vertical movement scrolls normally; dragging must not activate fullscreen. A tap opens fullscreen. Fit-mode swipes navigate; double tap/click toggles fit and actual image-pixel dimensions. At native size, drags pan only within actual image edges and never change the selected image. Provide visible image count, previous/next boundaries, fit/native buttons, close, keyboard arrows/Escape and focus restoration. Accept actual touch-emulated swipe, tap, double tap, drag, vertical scroll and desktop mouse/keyboard behavior, with real official image data. Avoid native-touch double-click toggling the same gesture twice. Modal height must be verified on narrow viewports, not inferred from desktop CSS.

Translated names and the parenthesized Japanese original occupy separate semantic display lines in both cards and detail. Keep raw source names unchanged; ja-JP and missing-translation fallback do not repeat parentheses. Long text must wrap without horizontal page overflow.

Recommendation issue directory titles, article headings and product names must display in full with natural wrapping, without ellipsis, line clamp or fixed-height clipping. Verify long Chinese, Japanese and English strings at desktop and mobile widths; hover tooltips do not substitute for visible text.
