# Standalone merchant issue-date editor

Status: source/isolated component tests ready for independent review; **not wired or deployed**. Two new frontend files; no R7 frozen source, shared API, locale, existing Recommendations entry, backend or business-data change.

## Contract and behavior

The component takes current post id/version, opaque actor/session identity keys, localized copy and typed get/save callbacks. It imports no API client and performs no direct fetch. The host must bind the authenticated merchant GET/PUT /api/merchant/recommendations/{id}/issue-date and render it only in the permitted merchant interface. This component is not an authorization boundary; the existing backend fixes owner/reviewer to its authenticated principal.

The private server review contains issueDate/sourceRef/sourceHash/reviewedBy/reviewedAt/source/version. Stored reviewed dates, full evidence and server identity/time are displayed read-only; UNKNOWN stays empty and explicit. It never guesses from title, publication time, activity dates or today. Source URLs are shown as inert text, not fetched. Calendar validation is ISO LocalDate without local timezone conversion. URL/message/hash checks validate deterministic syntax, not source truth or cryptographic correspondence. Human confirmation is required and resets after every fact change.

Save constructs exactly five fields: issueDate, sourceRef, sourceHash, version, reviewed:true. No reviewer, actor, user, merchant, item, article/publication or URL mutation field is sent. The hash is canonicalized to lowercase, as the server does. A matching valid server response is required before saved state/onSaved; inconsistent or stale responses are rejected. The host callback should preserve status409/errorCode RECOMMENDATION_CHANGED rather than dropping the structured error.

A conflict or uncertain save retains the draft, clears human confirmation and blocks another save until an explicit successful re-read followed by fresh confirmation. Re-read shows the latest stored evidence alongside the retained draft, never silently replacing edited facts. An explicit Use stored values action can discard the draft. Known post-version changes also invalidate review without erasing input.

Post/actor/session scope and operation generations guard all asynchronous state and saved callbacks, including A→B→A and out-of-order re-reads. Rendering a changed scope hides the previous review/draft immediately. Unmount invalidates outstanding completions. A synchronous in-flight write guard prevents double submission. onDirtyChange is available for the host's existing leave-with-draft warning. No draft/evidence/token is persisted by this component.

## Executed validation

41/41 unique JSDOM/mock/protocol cases PASS; complete current frontend TypeScript PASS. One384MiB Node worker. Cases cover UNKNOWN/no inferred dates, saved evidence and server identity, exact request allowlist, confirmation reset, 409 re-read/re-review/current version, uncertain-save recovery, mismatched responses, post/actor/session late GET and SAVE, returning identity, operation order, external version changes, stale reads, double submit, unmount, failed-read retry, inconsistent UNKNOWN response, explicit discard and source/date/hash format boundaries.

Original first run is retained: 40/41 passed; the double-submit fixture looked up the button by its original exact name after AntD added a loading icon name. The corrected test keeps the same actual button reference and preserves the one-submit assertion. R2 passed all41; no production assertion was removed or relaxed.

Real API/owner permissions/PG/source retrieval/save/GUI are NOT_RUN. The UI is deliberately not connected to the application, shared API or four-language files. No new formal bundle was built because the frozen R7 bundle does not import this new component. It is not evidence of an end-to-end date-edit feature.

## Frozen inputs and handoff

Backend contract manifest 7390d68d1b025cea1627f75e435f81330fa03fa30198d7fb1c7296d3699c1acd; R7 manifest 29bb354b4ec6d144d7419a9e133b819258b32ab48ae1486824cf55042f7b2859, all11 frozen files unchanged. Shared index a27acc24c17f71dfa773b82a289e79c0a215d70c676651ae32fcb0dbbd955953, unchanged. No port/browser/JVM/Docker/PG/service or real API operation was started. Last lightweight checker ended 2026-11-09T14:43:39.747Z; source frozen at 2026-11-09T14:46:39.711Z.

Evidence folder .task-tmp/date-editor-20261109 contains prewrite, original failure, R2 results/type log, report, exact source patch and file hashes. Next integration owner supplies the four-language copy, authenticated wrappers with structured409 failures, actor/session identity changes, current post/version and a safe onSaved detail/summary refresh. Actual isolated backend/GUI acceptance follows that integration.
