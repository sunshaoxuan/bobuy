# Visible browse v1 — frontend design and request budgets

Sole execution root: `.task-tmp/media-upload-fix`. All source, dependencies, tests and evidence stay there. Existing candidate trees are not executed/copied, no baseline source tree is generated, no hidden worker is used. Backend v1 recalculates on each request with no cache/migration; reduced payload/dependency is structural, not a proven CPU or latency gain.

## Request paths

| State/intent | Bounded content budget | Not requested |
|---|---|---|
| First activated product section | 1 product-browse page, at most 24 cards with inline badges/facets/totals; 0–1 sale lookup of at most 24 unique displayed IDs | Later pages, public marker batch lookup, detail/gallery/history, merchant definitions/assignment |
| Both product sections actually activated | At most one first summary and one bounded sale request per section; overlap is legitimate across marked/all and is not claimed deduplicated across sections | Remaining catalog traversal |
| First current recommendation section | 1 items page, at most 24 occurrences; 0–1 sale batch of unique product IDs (service cards need none) | Directory, historical records, bodies/galleries and management APIs |
| Explicit directory open | One 20-issue lightweight directory page, later directory pages manual | Issue body, item arrays, galleries |
| Explicit historical section open | One 24-occurrence historical page and bounded quotes as needed | Full historical issue bodies unless selected |
| Explicit product detail/deep link | One safe selected product detail; no list traversal to locate it; bounded additional quote only as needed | Other product details |
| Explicit issue/item/deep link | One existing full selected-issue read; selected item found there even beyond stream page zero; only selected body/gallery rendered | Unselected full issue bodies |
| Cart/checkout | Only current cart IDs, serialized in batches of at most 24; quoted user values remain unchanged until explicit review | Whole-sale-product catalog |

The shell's public bookable and active-trip summary reads are independent and do not block direct content routes. Their distinct booking/current semantics cannot safely be merged from the existing status-free summary DTO. Root home selection depends on active trips only. Node directory and private trip metadata wait for explicit navigation/private-route intent; unresolved auth cannot start the private metadata read. Public route-budget tests distinguish these small context reads from content reads.

## State and consistency

`useBrowsePages` owns one generation/current-query page stream. Page0 commits without any later page. Continuation sends that stream's `revision`; it never sends `datasetRevision` as a query cursor. Validate page/size/count/hasNext/duplicate keys and reject changed continuation. Rows and facet/count metadata are committed together. Ordinary next failure preserves earlier rows; no observer retries an error. A visible Refresh restarts a changed traversal.

Product all/marked registries compare only their shared product `datasetRevision`; recommendation current/history/directory compare only their shared recommendation token. Product and recommendation datasets are never compared. Global query/merchant/locale/auth/day/refresh changes reset their registry. Categories use server complete pre-category scope and are not invalidated because loaded rows do not contain them.

Each query generation must activate near the document viewport. A near-bottom latch allows one automatic continuation per entry and stays latched through layout/busy observer reconstruction. User movement out/in or manual action permits another batch. This prevents short/empty layout from draining the dataset. Without IntersectionObserver, initial page is usable and ordinary accessible load/retry buttons remain; real desktop/mobile viewport/sidebar geometry remains unverified.

An already-issued next page resolving under a drawer is buffered until resume, then committed only if generation still matches. Identity/unmount clears deferred data. Quote queues serialize <=24 IDs, avoid duplicate in-flight IDs as pages grow, stop on failure until explicit retry, ignore old identity completions, and revalidate loaded quotes at their declared validity boundary. No price/stock algorithm is moved to the client.

The UI uses genuine supplied first-picture URLs; no thumbnail URL/resize/compression is invented. First card images have priority/native lazy behavior for the remaining list; failures do not block text. Galleries mount only on explicit detail, retain active/adjacent interaction behavior, lazy-load thumbnail strips and use the existing explicit fullscreen modal. Actual transfer bytes/cache behavior are not inferred from DOM node counts.

## Permission and compatibility

The frozen context-action editor guard, ownership gate, draft/busy close protection and definition-route link are retained. The public catalog's changed read path is retested with the original role/clear/save/conflict/identity scenarios. Unchanged editor source/evidence can be reused only where hashes match. Existing backend 18 narrow tests and compile evidence remain a backend milestone, not frontend or DB acceptance.

Legacy full-feed/public catalog endpoints and pure filter helpers remain compatible for other callers; public page defaults no longer use their whole traversal. Explicit admin draft preview is mounted only after its Preview action and retains existing display behavior; it is not part of public-route startup. Obsolete tests asserting whole-feed preload/collapsed-body prefetch are replaced by bounded-route tests, with service/price/source-text/publisher/locale behavior covered under explicit selected-issue and card contracts.

## Remaining real acceptance

Original main/QA bind exact built assets/backend and run permitted real DB/HTTP/browser checks serially in this root. Record actual requests/records/bytes and first-data-ready, image-ready and intentional full traversal separately; compare real cold/warm runs before claiming speed. Cover sidebar versus document scroll, phone/desktop, short list, pending/error/retry/409, day return, current/history/service, deep links/back/forward, marker save/stat invalidation, permissions, draft and quote/checkout flows. No user page, session, login, Docker or publication operation is authorized by this offline design.

## P2 detail action state precedence

The detail footer uses the same `pricePending(productId)` precedence as its price region: pending text first, then verified eligible Add to cart, otherwise unavailable. Pending includes unverified failed quote reads and unresolved bookable context. Existing disabled/click conditions remain byte-for-byte unchanged; no new business state or resource key.

## P1 attribution rendering boundary

Parse optional gallery attribution with a guarded URL constructor. Only absolute HTTP(S) URLs with a hostname become external links. Prefer the supplied label, otherwise use that valid hostname. With an unusable URL, keep a supplied nonblank label as plain text; with neither usable field omit that attribution row and omit an empty source disclosure. Gallery image rendering remains independent. Closed details elements still evaluate JSX children, so parsing must be safe before disclosure is opened. No new translations or API semantics.
