# Real HTTP / PostgreSQL integration (2026-11-17 UTC)

Continues PR 158 above dde0f031dbf60d31973064c6c75677fff12e62a9; `source-sha256.json` binds the narrowly repaired HTTP error boundary. This evidence uses actual React, Spring controllers/security/services/transactions and PostgreSQL. No target business API routes were intercepted. All accounts/products/categories and all writes here are synthetic and isolated. It is not production acceptance.

Runtime: actual BobbuyApplication PID 18513, localhost 18081; Vite PID 18729, localhost 15173, proxying to 18081. Docker `pr158-e2e-postgres`, localhost 15432, database `pr158_e2e`, PostgreSQL 18.6 Alpine 3.23 pinned to sha256:1a0c23d53c1ad77468c8653fa6eed4f4105cfbef9e6f027bc1dfeb16949a8c29. Fresh database ran 46 project Flyway migrations through V45. Normal login/JWT security is used, header authentication and production seeds disabled. Task-only credentials are not included. AI/media workers, mail, Redis chat relay and Nacos/Sentinel integrations are disabled; these do not replace the tested import, image persistence, or catalog HTTP endpoints.

| Check | Evidence | Result |
|---|---|---|
| Structure initial import, explicit confirmation and database rows | smoke-report.json | PASS |
| Structure concurrent reorder rejection, fresh preview/roundtrip; mapping tenant scope, stale tree rejection, persistence and idempotency | http-report.json, passed entries only | PASS |
| Product profile stale version rejection and persistence | profile-http-report.json | PASS |
| Whole profile batch rollback; duplicate/unknown profile; price/publication protected; invalid mapping batch and changed product version | extra-http-report.json | PASS |
| Foreign preview confirmation returns generic 404 | privacy-http-report.json | PASS |
| Four viewport real structure/mapping/profile export, preview, confirm, profile export/repreview; homepage routing, child filter/reload/history | browser-report.json | PASS functional scope |
| Image upload, invalid PNG leaves previous image intact, replace and reload, public drawer reads stored image | image-report.json | PASS |

`http-report.json` preserves an early fixture error after its passed entries: description was null rather than application-default empty localized content. The fixture was corrected, and profile behavior is separately verified by profile-http-report.json. A later fixture correction used object merchant_skus, matching the application schema. These were isolated fixture defects, not production data repairs.

The mobile functional run initially waited on a desktop-only Sign out control. Setup was corrected to wait for authenticated navigation completion. Initial mobile navigation captures caught the drawer transition; they are excluded as visual PASS. Stable captures and image navigation capture are reviewed separately. Previous `final-ui/` native raster/44px control evidence remains applicable to unchanged UI source; this batch changes only HTTP exception types/translation at the server boundary. No Gemini reviewer tool is available; main-agent actual screenshot review remains required.

The HTTP bug fixed in this batch was expected validation/conflict being flattened into generic 500. Typed conflicts now return 409, malformed category input 400, missing/foreign import 404. Existing locks, snapshots, access checks, transactions and idempotency are retained. CategoryImportHttpErrorTest: 2 tests PASS in the native common reactor; no duplicate local full suite.

Production is not released. No production data writes or production tasks were started. Production connection/operator access and the complete SHA-verifiable original CSV archive remain unavailable; current local first three archive parts are truncated. Other production writers and baseline cannot be verified without that access. Original business exports and credentials are excluded from this directory.

Two actual browser pages: stale structure confirmation displays actionable conflict, retains confirmation on failure, then repreview/reset and explicit confirmation succeeds. ui-conflict-report.json also verifies collapsed state after reload at 1280/390/360; stable navigation captures replace transition captures. Main agent reviewed 1440 navigation, 390 image navigation and 360 stable navigation.
