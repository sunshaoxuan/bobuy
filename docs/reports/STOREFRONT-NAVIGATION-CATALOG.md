# Navigation / visual / catalog release 20261026.3

2026-10-26. Independent production release 20261026.3 is active. Runtime source
93394f79c9f59b6106f35f81a5817eef32a697dc; exact-head CI 40312520350 passed.
Public production UI/API/static bytes, six image IDs, health, verified backup,
protected services and frozen content preservation all passed. Private production
preview remains for the parent's existing authenticated normal UI; credentials
were not obtained. Actual price/purchase activation remains pending currency.
Only code/schema was activated: no production content writes, product backfill or
article publication occurred. Verified before/after content: post 1 has 122
items (121 assigned to 13 categories, 1 source conflict unclassified), post 2 has
30 independently priced online-source items. All supplier displays off; both
drafts. These are 152 recommendation rows, not necessarily 152 unique products.
Any eventual deployment must take a fresh frozen baseline, never restore the
earlier unclassified post 1 state.

Independent release boundary: navigation/visual/search/node isolation, shared
private preview and private catalog creation/reuse can ship together without a
selling-currency decision. No new sale quote, checkout amount, FX conversion,
stock availability or product purchase activation is implemented. The existing
base-price algorithm is untouched. Profile provenance is anchored in an immutable
reserved Product ID namespace, so ordinary attribute/visibility edits cannot
accidentally expose these pending-price products. No new credentials are needed.

Implemented: visible desktop navigation and contextual node selector; mobile
drawer; bookable/executed trip routes; authorized orders/bills scoped to node;
locale-aware sans-serif typography; wide round search; natural image/card
proportions, rounded corners, whitespace and legible price/period facts. Nodes
only narrow existing visibility and never modify authorization/tenant headers.
Recommendation node lists exclude drafts; wrong-node detail returns 404; stale
async results are ignored, history/refreshed URLs keep node context.

Draft preview now shares the actual customer issue, image cards, category chips
and fact rendering, with local search/device width and no public draft endpoint.
Both user screenshots were successfully materialized by the unmodified current
Library helper through the host's existing Ubuntu runtime after native Windows
failed on os.setxattr. Their actual pixels were inspected. Design/acceptance
contract: `docs/design/STOREFRONT-PINTEREST.md`.

Catalog work: normal recommendation registration creates private, unpriced real
Product profiles; stable source-issue/code/name identity makes retries idempotent.
The same Product rows appear in existing stock master; no parallel catalog or
invented stock is created. A visible panel can build profiles for old unlinked
items or explicitly reuse an owned existing product. Reuse checks ownership
without loading mutable entities, preserving even existing updatedAt/metadata.
Source quotations and channel issues remain separate. V11 replaces the global
official-code uniqueness constraint with a nonunique owner/code lookup index;
ambiguous lookup results require review rather than picking an arbitrary row.
V12 also removes an optional owner/code unique index from earlier PLAN-64 local
installations. This was found in an actual PostgreSQL rehearsal. Previously
applied migrations/checksums were not edited, repaired or ignored. The clone
verified unchanged data, same-code variants and restoration of original rows and
unique constraints, then removed its temporary database.
No migration backfills real content. Pricing-confirmation endpoints were removed
while the actual selling-currency decision is unresolved. New recommendation
profiles are excluded from storefront/checkout even if visibility is changed;
the legacy sale-price calculation has not been changed.

Completed checks: frontend TypeScript/Vite/i18n (964 keys); affected prior cards,
recommendation editor, category filters; 3 navigation/race/preview tests; backend
node isolation 1 and classification 3; final recommendation integration 10
passed with zero failures/errors, including product timestamp preservation.
Two additional backend tests passed for visibility/attribute/quantity bypass
prevention and cross-owner/ambiguous-code links. Frontend node/history/cart
context tests passed: late responses after node/account changes are ignored,
refresh chooses the URL node, and selecting All preserves the cart request ID.
Existing shared local containers were reused, with saved prior binaries and a
local-only V7/V8 resource overlay. Its byte comparison applies to the then-tested
intermediate local JAR. Final backend safety changes are covered by exact-head
CI; final production Java JAR hashes and all six image IDs are separately bound
in the production receipt. No checksum repair/ignore or new test container was
used. V11 started successfully locally; V11/V12 restore rehearsal passed.

Actual normal local browser: six synthetic entries with public official source
pictures, normal upload/JSON review/registration/save/reopen, automatic private
profiles, shared preview, populated public synthetic issue, search, actual node
dropdown, browser back/refresh, mobile drawer/itineraries and no overflow passed.
Synthetic post 12 was withdrawn. No orders/payments were submitted. Initial
button/Select harness mismatches were corrected and the existing fixture reused
without another registration. `evidence/storefront-navigation/local-browser.json`
and screenshots record this. Final narrow font/mobile-search polish passed:
mobile search spans at least 340 px, actual root uses the intended locale-aware
Segoe/Noto Sans stack, drawer brand color is correct and no page errors or
horizontal overflow were observed. `polish.json` and polished screenshots are
the final evidence. Existing successful registration/card flows were reused.

Two automatic approval rejections, neither pending nor retried:
1. Applying a reviewed JPY price tier to StorefrontService/checkout was denied
   because it could confuse reference JPY with USD selling prices and cause
   incorrect charges. That patch did not execute. Base-price calculations remain
   unchanged; no reference amount is copied into a selling price. The only later
   checkout change rejects newly unpriced recommendation profiles.
2. Adding a verifier that reads production /etc/bobuy-admin.json over SSH was
   denied as unauthorized credential access. The script was not written and no
   credential read occurred. The replacement local verifier uses local test login
   only. Future private production acceptance can reuse the parent's existing
   authenticated UI instead; do not retry the rejected credential path.

Required business decision (question submitted, no answer received): actual
customer selling currency. Product.basePrice has no currency, stock labels vary
with locale, while the current storefront/checkout formats JPY. Choose uniform
JPY, uniform USD, or explicit product currencies before completing the real-price
confirmation/cart/order contract. Official source prices remain JPY and actual
selling prices must be manually confirmed; never infer conversion or free sale.
This is not a generic release approval. No general deployment permission is
missing. Purchase enablement is a separate pending decision; it no longer blocks
preparing the independent safe release above. Exact-head CI and production
backup/migration/content-preservation verification gated activation and passed.

Final release evidence is under evidence/storefront-navigation-production/.
CI: backend 204 tests (2 skipped), zero failures/errors; frontend 103 tests in
32 files. Coverage lines 93.69% (minimum 90%), branches 80.26% (minimum 70%).
No threshold was lowered. The existing CI finished in 2m 53s and was not retried.
The mirror package SHA256 is
8e4e8ba55125391fa6690250ad093b8bf122ac0afa1193109a32fa62c82cb76d.
Both drafts and 152 image blobs remain; Product count is still 0, so there was
no implicit backfill. Supplier assignment/visibility and all original facts,
prices, dates, notes and image bytes match the stopped-writer snapshot across
seven tables. All five application health checks passed; frontend is running;
all six restart counts are zero. Protected service state is unchanged. The
verified database/object backup is /opt/bobuy/releases/20261026.3/backup/.

One release-process mistake is retained explicitly: raw-byte config validation
failed on compose.production.yml, but activation was started before that result
was inspected. Diagnosis proved only CRLF/LF variation: local LF-normalized SHA
and production raw SHA both equal
1681b2307b554cb1b92ca0766927ead2228cc53c7b983edf9cc3e0e5182c1b5f.
Production configuration was unchanged. Backup, migration, frozen content,
health and public browser verification subsequently passed; no rollback was
needed. The original failure/correction receipt is retained, not labelled an
initial preflight pass. Future execution must short-circuit validation failure:
validate first and activate only in the same checked/conditional execution chain.
Only CRLF/LF may be normalized for these YAML source comparisons; archive,
image, JavaScript and Java JAR identities remain exact byte/hash checks.

Smallest follow-on after the business decision:
- Uniform JPY: retain the current customer currency presentation; add an explicit
  manual actual-price review in the visible catalog panel and persist that quote
  separately from official source facts/base USD prices. Only its reviewed
  product ID with a valid trip and confirmed pre-order rules can enable direct
  add-to-cart. Do not reuse the rejected patch without new user evidence.
- Uniform USD: make the selling currency explicit in product/cart/order data and
  UI together; preserve historical JPY orders. Actual USD amounts must be supplied
  by the operator, not inferred from JPY source prices.
- Per-product currencies: persist product/order currency and enforce a defined
  non-mixing basket policy or separate baskets. No arithmetic across currencies.
The current inventory UI has a placeholder quantity and source stock-status
flags, not an authoritative reservable stock quantity. Start with explicitly
confirmed existing pre-order fulfillment; keep direct-buy closed until a real
stock/limit source and server-side enforcement exist. Test rapid repeat clicks,
quantity caps, idempotent checkout, unavailable/expired trips and ownership in
synthetic environments; never use a real order/payment for acceptance.
