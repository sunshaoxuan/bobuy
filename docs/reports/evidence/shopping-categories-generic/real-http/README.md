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

Production is not released. No production data writes or production tasks were started. Direct cloud SSH and a verified classification-data operator are not available, the original archive reception gap has now been resolved (receipt below). Other production writers and baseline cannot be verified without that access. Original business exports and credentials are excluded from this directory.

Two actual browser pages: stale structure confirmation displays actionable conflict, retains confirmation on failure, then repreview/reset and explicit confirmation succeeds. ui-conflict-report.json also verifies collapsed state after reload at 1280/390/360; stable navigation captures replace transition captures. Main agent reviewed 1440 navigation, 390 image navigation and 360 stable navigation.

Guest real HTTP acceptance: all four viewports passed direct-root selection, return to all products, ITEM search, refresh, opening the shared URL in a new page, and no horizontal overflow/page errors. Mobile keyboard open/Escape close restores trigger focus. guest-report.json and guest captures bind this evidence to unchanged UI plus 8e102b46 server candidate.

Image failure boundary clarification: the browser invalid PNG was rejected by frontend validation before HTTP. image-http-report.json separately sends malformed PNG directly to the actual backend (400), customer upload (403), child-node upload (400), and asserts the database root image reference is unchanged. Successful uploads and replacements use actual HTTP and storage.

Release-channel clarification: existing `.github/workflows/cd-production.yml` is a main-only production CD channel, with successful build/deploy run 43861595193 for 007c310c11266432b5762ae0e52fee23a5612965 on 2026-11-16. This is historical evidence, not the current production revision. Reading environment secret metadata returned HTTP 403 Resource not accessible by integration; no secret value was requested or bypass attempted. No CD was dispatched to probe access. Public homepage read on 2026-11-17 references /assets/index-DQfUxku3.js and /assets/index-DsmEmSak.css. Exact installed service hashes, active data writers, scoped data backup and actual classification import operator still require verified operational access before business-data rewrites.

Native candidate gates for 8e102b46e0bc8fdc25020e89a6dd7971d9ba674b: PR checks 44133545303 (backend/frontend), CodeQL 44133545093 and dependency-check 44133545588 all SUCCESS. No equivalent full local rerun.

Archive reception gap resolved: the exact 64,704-byte source archive and all four per-file manifest hashes now match. See `csv-reception-receipt.json` (counts/hashes only). Raw CSVs remain private. Current production matching is still required. `template-invalid-http-report.json` records real template endpoints and atomic rejection of an invalid parent row.

Original category artwork: 26/26 generated and main-agent visually reviewed at large preview and native 32px; final upload PNGs are 256×256 with alpha, 1,039,281 bytes total. Dimensions, safe bounds, alpha and unique image/category hashes PASS. See artwork-manifest.json, artwork-validation.json and artwork-preview.png. Private release-ready bundle is /workspace/artifacts/pr158-category-icons.zip. No production image binding has occurred; that is a separate outstanding acceptance item.

Task-owned runtime cleanup is complete (cleanup-receipt.json): the isolated database container and backend/Vite processes were stopped/removed, and temporary test credentials/log containing generated credentials removed. Shared tooling/other Vite and formal deliverables retained. Current release block is operational access/baseline/recovery and subsequent production acceptance, not source-archive transport or isolated integration. No production writes or production jobs started.
