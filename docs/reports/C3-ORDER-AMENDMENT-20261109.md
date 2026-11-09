# C3.1 independent order-amendment candidate — 2026-11-09

Baseline: `82b8daf7fe275d6dd623b36621f1cf2596dc0e98`, branch `c3-order-amendment-20261109`, isolated existing-project worktree `.task-tmp/c3-order-amendment-20261109`. The seven new implementation/test files were hash-verified into this worktree; the original C2 checkout and its immutable remote CI input were not changed.

## Implemented requirements and design

`CustomerOrderAmendmentPolicy` admits only the authenticated owner's NEW + UNPAID order, before purchasing, picking, receipt, billing, delivery or settlement commitments. Published trip/date checks retain the checkout boundary. Null, malformed and unknown states fail closed. CONFIRMED directs the customer to the merchant; paid/refunded and terminal orders stay read-only. Another customer's revision is not returned. Expected revision mismatch denies the edit.

`CustomerOrderAmendmentRequest` is a separate immutable whitelist: canonical request UUID, expected revision, unique product/quantity lines, optional complete order delivery snapshot. Omitted delivery retains the snapshot; a supplied incomplete snapshot is rejected. Unknown fields are rejected at the request, line and address levels even when the global Jackson unknown-property check is disabled. No customer identity, merchant identity, price, payment, fulfillment or role field is accepted.

`CustomerOrderAmendmentFingerprint` hashes a sorted, length-delimited payload bound to the authenticated customer, order and expected revision. It distinguishes a retained address from an explicit replacement. The request UUID is the idempotency lookup key and is deliberately absent from the payload hash. This hash is not a revision source.

`CustomerOrderAmendment` is an unwired quantity form with injected server view/save function and translated labels. It retains drafts on 409 and newer incoming revisions, requires explicit reload before retry after conflict, reuses one request UUID for an uncertain unchanged retry, and resets on identity/order/session-key changes. A known old parent prop does not overwrite an accepted save response or prevent a subsequent edit. Newer refreshes win over late mutation results. Neither the form nor these modules create an order or perform a funds operation.

## Tests actually executed

- Java source compilation with JDK 22.0.2 targeting Java 17: PASS. Six explicit source files only, cached Jackson 2.15.4/JUnit 5.10.2 dependencies; max heap 128MB, one CPU; no Maven/Spring/database.
- Pure JUnit: 4/4 PASS, no skipped tests. Owner/revision policy; state/payment/fulfillment commitment matrix; positive and negative Jackson whitelist/address parsing; canonical fingerprint and address/identity/revision binding.
- Component tests: 7/7 PASS. Conflict draft/reload, retry idempotency payload, account change, locked/invalid form, consecutive successful saves with old parent props, newer refresh during save, session rotation.
- Narrow TypeScript check of the two new component/test files: PASS.

The initial default-sandbox dependency junction failed EPERM before frontend tests started. The same operation passed through the normal reviewed native path, reusing existing installed dependencies and private test/cache paths. Initial default-sandbox javac timed out; its record is retained separately from the native reviewed successful compile/JUnit run. No assertion was removed or relaxed.

## Remaining gates — not implemented or not run

This candidate is not the complete C3 feature and is not ready for release. It installs no route, controller, persistence write or migration. The authenticated customer endpoint must obtain a fresh locked order/trip snapshot, derive a trusted revision covering every customer and merchant writer, revalidate product/trip/quantity/price and immutable history, and atomically apply an idempotent edit with optimistic/conflict protection. It must not call the generic management update path that defaults payment state to UNPAID.

The form still requires production call-site wiring, fresh server reload behavior, four-language labels, a session-generation key and any address-edit UI. Database concurrency, request replay transactions, merchant/customer contention, integration/remote CI, formal-package real browser acceptance and production remain NOT_RUN. No C2 runtime/PG result is counted as C3 runtime evidence.

No browser, service, database, container or production action was performed. No commit, stage, dependency install or change to C2 baseline files was performed. Local dependency junction only reuses the existing C2 `frontend/node_modules`; test config and cache are private to C3.
