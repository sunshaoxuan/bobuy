# Client navigation and visual acceptance

The client follows Pinterest's image-first browsing direction while retaining the
Bobuy brand. This is an overall visual requirement, not merely a category-chip
interaction. Do not revert to a crowded header or heavy decorative typography.

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
