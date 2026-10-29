# Home default and mobile shortcuts

Scope: frontend navigation only, based on production commit
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
- No backend, schema, credentials, actual content, pricing, inventory, purchase,
  registration, or storage changes. Existing fullscreen viewer is reused unchanged.

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

Release scope when separately approved: frontend only on top of production
20261029.1, no migration or new secret. Preserve the current frontend image and
compose file for rollback. Production acceptance must confirm the new root
default, `/products` deep link, desktop navigation and mobile shortcuts after
deployment; these local fixtures do not establish production success.
