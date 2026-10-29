# Home default and mobile shortcuts

Scope: navigation plus a compatible core public-trip display projection, based on production commit
`f97b22e5af3750296b1d54cc6336ec457723e22b` / `20261029.1`.
The user requested implementation and local acceptance, not a new deployment.

## Findings and implementation

- Existing `/` always showed trip finds. The existing server's public trip query
  already narrows to PUBLISHED trips with delivery date today or later.
- After successful loading, an empty current-node trip result replaces only the
  root URL with `/recommendations`; service failures stay visible.
- Added `/products` as explicit trip finds, so intentional browsing is possible
  without an automatic bounce. Existing root links with available trips still work.
- Recommendations precede trip finds in the shared main navigation. The mobile
  bar has exactly the four requested destinations and preserves node context.
- No schema, credentials, actual content, pricing, inventory, purchase,
  registration, or storage changes. Core's display-only query correction is
  documented below. Existing fullscreen viewer is reused unchanged.

## Verification plan and delivery boundary

Focused unit tests cover node-aware home decisions, request errors, explicit
destinations, back/forward, navigation order and existing price/cart isolation.
Existing lightbox tests protect click/double click/Escape behavior. Four actual
browser scenarios cover desktop and touch emulation, each with/without trips,
anonymous account/cart, refresh/history, selected links, touch size, responsive
layout, modal stacking and no API mutations. Fixture APIs exist only in the
browser runner and cannot write production.

The local Playwright/Vite runner must exit and release its process/port before
the scheduled 2026-10-29 01:00 UTC Docker/WSL maintenance. No containers are
started for this batch. Final outcomes and screenshot identities are recorded in
`.task-tmp/store-shortcuts-review/acceptance.json`; missing checks remain pending.
Do not deploy or trigger deployment without this batch's specific approval.

## Accepted local results

- 9 StorefrontContext cases PASS on the final home logic, including dismissing
  an API error without treating it as a successful empty trip response.
- 3 StoreNavigation cases and 5 shared ImageLightbox cases PASS. Their relevant
  inputs are unchanged by the subsequent mobile-only icon-size correction.
- 4 desktop/touch browser cases PASS; after the icon correction, reran only
  the 2 mobile cases, both PASS. All contexts were anonymous, all APIs were
  mocked read-only, and mutation attempts and page errors were both zero.
- Desktop screenshot preserves the sidebar/header layout with no bottom bar.
  The 390x844 screenshots show the four touch shortcuts, selected destination,
  consistent 22px icons and unchanged image-led card treatment. The last card
  can scroll completely above the bar. Modal/drawer stacking, image opening
  and Escape closure passed in desktop and touch contexts.
- 1182 four-language resource keys PASS, TypeScript PASS and final Vite build
  PASS. Existing vendor-size warning is unchanged; no dependency modifications.
- The first sandboxed browser runner stalled before any UI case, was stopped,
  then the approved native test runner completed normally. No product failure
  was inferred from this test-start problem. Both successful runners exited;
  a final 127.0.0.1:5173 check returned ECONNREFUSED (port released).
- No Docker containers or WSL services were started/stopped; no production
  requests, uploads, content edits, push, CI trigger or deployment occurred.

Release scope when separately approved: core and frontend on top of production
20261029.1, no migration or new secret. Deploy the compatible core query before
the frontend. Preserve the current frontend/core images and compose file for
rollback. Production acceptance must confirm the new root
default, `/products` deep link, desktop navigation and mobile shortcuts after
deployment; these local fixtures do not establish production success.

## Semantic correction after parent review

The initial candidate `d96c7ac` used bookable trips to decide whether to show the
home catalog. This would exclude IN_PROGRESS trips. It is superseded by the
follow-up semantic candidate, not a production release.

- TripStatus has PUBLISHED, IN_PROGRESS, COMPLETED and SETTLED; no sold-out state.
  Trip has deliveryDate, status and statusUpdatedAt, but no start timestamp,
  bookable-seat or sold-out field. Transient weight/volume are not eligibility.
- The normal `/api/storefront/trips` contract stays bookable-only. Its optional
  `includeCurrent=true` adds IN_PROGRESS to the same existing public summary
  projection (ID, merchant, destination, delivery date). No security rule changed.
- Home and its node context use the broader display list; trip selection, cart
  validation, recommendation buying and checkout use the unchanged bookable list.
- Future/today PUBLISHED remains visible even with no sellable inventory. Past
  PUBLISHED is expired under the existing date rule. IN_PROGRESS remains visible
  until operational completion, even if deliveryDate has passed. Completed and
  settled do not keep the home catalog active. Deep links remain unchanged.
- Added three pure repository/MockMvc tests for the server rule and query
  compatibility, with no database/container. Added a frontend case proving that
  in-progress product content stays visible but its add action cannot create a
  cart entry without a bookable trip. Six real desktop/touch browser scenarios
  now cover no trips, upcoming and in-progress, each with history/deep links.
- Final frontend build and ten context tests pass; unchanged navigation/lightbox
  tests and language checks remain valid. Exact results and the final commit are
  recorded in `.task-tmp/store-shortcuts-semantics/acceptance.json`.
- All three server tests pass. The initial sandboxed test JVM failed before
  execution; the normal native JVM passed, but the default quoted output path
  did not produce JaCoCo data. A bounded retry specifying only an ASCII temporary
  `jacocoDataFile` produced and analyzed coverage normally. No plugin, threshold,
  test or gate was disabled. This focused run is not a full CI coverage claim.
