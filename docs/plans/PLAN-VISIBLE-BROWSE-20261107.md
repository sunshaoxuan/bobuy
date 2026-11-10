# Visible browse v1 — requirements and candidate status

User requirements: show/load bounded visible content on Product Picks and Trip finds; calculate complete-range category statistics on the backend; preserve navigation, shopping and permission-context operations; keep one test root; record requirements/design/test evidence/change history for every candidate. PM remains coordinator. This is an UNRELEASED source candidate, not a runtime/performance acceptance.

Inputs: HEAD `e26cab4ef0e8d22afb0b2e28b880bfd6dfbe0a35` plus frozen permission-context nine-file increment and backend browse v1. Authoritative contract: [CONTRACT.md](../../backend/test-results/server-browse-20261107/CONTRACT.md), backend manifest SHA256 `641c70e0fe6d1060c3eeb0a40f25419272c01b3a86fd6fdf6b887d15f5c7bea7`, source digest `cf89c05b25379524b8b12d2b32a2b01b81b93f666c0f8d26a59e5123ece746bc`. No commit is implied: the original Git index.lock denial remains stopped.

Acceptance:

- Direct `/products` and `/recommendations` render independently from metadata and never await whole product/issue traversal. Bare `/` waits only for active-trip metadata needed to choose its existing home context/menu; bookable trips remain a distinct purchase/checkout condition. Root retains quantity selection, explicit catalog/recommendation pages retain their existing add/eligibility rules.
- Activated product sections read one 24-row summary with inline public badges, backend pre-category facets and category-restricted total. Recommendation sections read 24 occurrences; `(postId,itemId)` and service occurrences remain distinct. No client full-range count or first-page-only search fallback.
- Further batches require near-bottom entry or deliberate action. One request in flight, stable append, no duplicate rows or terminal empty request; a still-visible sentinel does not drain all pages. Successful previous pages survive an ordinary next-page failure; retry is deliberate. 409 or shared-dataset mismatch requires visible refresh.
- Unopened directory/history/body/gallery/admin data stays unrequested. Directory is an explicit 20-issue light read. Product detail and one selected full issue load only on explicit open/deep link; later-item deep links use that full selected issue rather than traversing unrelated pages. This existing issue detail API may contain all items of that selected issue; it is not misrepresented as a bounded single-item HTTP response.
- Bounded current sale reads contain 1–24 unique IDs. Summary text does not wait for quotes. Pending/failed quotes or bookable-trip metadata do not show a fabricated price/unavailability, and cannot submit buying actions. Missing verified sale rows remain information-only cards. Existing quote revisions/tokens, explicit cart price review and server checkout revalidation remain intact.
- Drawer/detail/discard/save/navigation/cart interactions pause automatic paging; already-issued continuation can be cached but is not appended while paused. Query, merchant, category, locale, path, auth, refresh and applicable Japan-day identities isolate stale work. Marker save invalidates both product sections/statistics together without unmounting conflict drafts.
- Same-owner resolved AGENT-only management controls, platform-only/foreign/customer/anonymous negative behavior, clear-as-draft and guarded definition navigation remain. Backend scope enforcement is untouched.

Implementation/design: [VISIBLE-BROWSE-V1.md](../design/VISIBLE-BROWSE-V1.md). Candidate evidence: `frontend/test-results/visible-batch-20261107/`. Actual GUI/network/DB/performance/runtime/CI/production are separate NOT_RUN gates. Prior login, Docker, CIM, Mockito attach, index-lock and push refusals are not retried by frontend.

## P2 detail pending correction

An opened product detail must label its disabled action as checking price/availability while the bounded sale read is pending or failed, or required purchase context is unresolved. Only completed checks may label it unavailable. Reuse existing text and preserve disabled/click eligibility guards. Scope: one detail button label and five focused regression cases; no backend/runtime change.

## P1 recommendation image attribution correction

A public selected recommendation item must remain readable when image sourceUrl is null, missing, empty or malformed. Keep the genuine image, valid HTTP(S) source links and supplied attribution labels. Do not invent source links. Required regression includes the QA route /recommendations/961001?item=981027 plus closing, switching and returning to item detail. No backend/API or purchase-rule change.
