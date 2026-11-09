# Per-item recommendation publication — frontend candidate

2026-11-09. Source and lightweight validation only; not deployed.

Product issues now show each item as pending review or published. A ready item can be published separately after explicit review; an already published issue accepts new pending items without withdrawing its existing items. Product issues no longer offer whole-issue publication/withdrawal controls in this UI. Service offers retain their existing whole-article path.

Publication sends only requestId, post version, exact product version, review source hash and reviewed=true to POST /api/merchant/recommendations/{post}/items/{item}/publish. Missing or malformed metadata cannot enable publication. A synchronous lock prevents duplicate clicks. An uncertain response retries the identical request body and key; conflicts keep the draft and require an explicit reload and fresh review. A contradictory post flag or older response does not produce a success notice.

Appending from a product keeps the original offer draft through conflict. Explicit reload shows the latest master specification/version, preserves the original reference context, clears review and asks the operator to compare both. String equality is not used to infer formula/packaging identity. No product facts, prices, source hashes, existing public snapshots or image assets are modified by this frontend task.

Only pending items reach catalog/localization/gallery editing panels. Classification also enforces pending-only selection and clears stale selections when an item becomes public. Post state is not falsified for the editor. The existing App merchant route guard is reused; customer navigation receives no new management entry. Backend ownership and public exclusion remain authoritative and are separately implemented/reviewed.

## Validation

PASS: 28 unique component/API tests. The final evidence combines 19 cases from final-r4 (the two changed files) and 9 unchanged cases from final-r2. Earlier overlapping executions are not added. TypeScript and four-language key/reference checks pass. Tests use actual frontend modules with JSDOM and mocked APIs/Ant boundaries, not a live backend or browser.

Coverage includes ready post8 item vs missing 1731065, seven public items plus an eighth, exact request contract, double-click and uncertain-response retries, conflict/reload with retained article/offer drafts, original source context vs updated master specification, account/token/issue/unmount late-response isolation, pending-only classification, malformed metadata, contradictory publication responses and service-offer compatibility.

The original two obsolete behavior assertions (hide append on a published issue; publish a whole product issue) and their failures are preserved. R1 had five fixture errors and two test-only type errors; original logs/results remain. Those fixtures were corrected without dropping the affected behavioral assertions. A runner parse error and a default-sandbox junction failure are also retained as tooling NOT_RUN evidence.

## Remaining gates

NOT_RUN: real authenticated API/ownership/concurrency, PostgreSQL V31 migration and snapshot persistence, formal CI bundle/OCI binding, independent QA and real nonproduction mobile/desktop browser journeys. These tests do not establish public-feed exclusion or preservation of real production content; those require the exact combined backend and final built application. No browser, production request, upload, business datasource, JVM/Docker service, credential read, stage, commit or deployment occurred in this frontend task.

Source baseline: 82b8daf7fe275d6dd623b36621f1cf2596dc0e98, isolated recommendation-item-publication-20261109 worktree. The parent owns all later git/integration actions. Frontend file hashes, patch and exact test ledger are in .task-tmp/item-publication-frontend-20261109/.
