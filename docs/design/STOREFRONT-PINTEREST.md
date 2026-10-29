# Client navigation and visual acceptance

The client follows Pinterest's image-first browsing direction while retaining the
Bobuy brand. This is an overall visual requirement, not merely a category-chip
interaction. Do not revert to a crowded header or heavy decorative typography.

## Home and mobile shortcuts (2026-10-29)

After successful initial loading, the bare home route shows trip finds when the
current node has a bookable trip. Otherwise replace it with recommendations,
preserving its query context. Use the existing server bookable-trip result
(published, delivery date today or later); do not invent another date/status rule.
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
