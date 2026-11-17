# Generic category / product file-transfer acceptance

This continues PR #158 and `docs/tasks/storefront-two-level-20261116.md`. All new browser data is synthetic, served by intercepted local API routes against the actual React application; backend behavior is separately tested with mocks and isolated H2. These screenshots do not claim production or live-backend integration acceptance. No production writes, migrations, imports, merges or deployment were performed; no production write task was started.

Candidate identity: `candidate-source-sha256.json` binds directly affected source files to the reviewed working candidate above base `77983bdc362f877bc8d33053cb014d777fa40b43`. Repository commit history binds this evidence to the submitted candidate. Four viewport sizes: 1280×800, 1440×900, 390×844, 360×800.

| Direct behavior | Evidence | Result |
|---|---|---|
| Mapping template/export, invalid duplicate, cancel without confirm, conflict rejection, fresh preview/confirm, repeat guard | mapping-final-report.json; service 29 + authorization 1 tests | PASS |
| Structure template/export, row errors, stale preview, explicit confirmation | category-admin-final-report.json; existing structure tests reused | PASS |
| Product JSON template/export, duplicate identity, preview, stale version, fresh confirmation, readback/export/repreview, cancel | catalog-final-report.json; catalog integration 6, panel 8, transfer 1 tests | PASS |
| Whole-batch rollback, retry and idempotent confirm | CategoryMappingTransactionTest (actual isolated H2) | PASS |
| Root/direct and child products, configured order, left navigation/drawer, selection and refresh, no top category strip | root-direct-final-report.json and screenshots; browse service 13 tests | PASS |
| Category image upload/replace | existing 1280/390 evidence plus category-image-final-report.json (1440/360) | PASS |
| Missing image fallback in navigation/admin, then new image replacement | category-image-fallback-report.json, navigation-image-fallback-report.json, CategoryImage test | PASS |

Final presentation captures and computed styles are under `final-ui/`: all four viewports for mapping, structure and product editor. Console/page errors and horizontal page overflow are checked there; table overflow stays inside its scroller. Raster check: 60/60 controls PASS (3px inner clearance and the project vertical centering budget). Pixel analysis uses native-size control screenshots, not DOM text rectangles. Main-agent visual review is authoritative alongside the recorded measurements. The environment exposes no Gemini reviewer; direct screenshot review, computed style checks and raster measurements are the fallback, not a waiver of functional acceptance.

The earlier top category-strip / fixed-source screenshots in `shopping-categories-20261116` are superseded for navigation. Existing unchanged card and backend projection tests remain reusable. Original real-data counts, business CSVs and pending item identities are neither constants nor acceptance prerequisites. The master JSON importer edits existing identities; unresolved/new identities are not silently created, temporary rows are not converted to masters, and price/stock/publication are outside this file edit operation.

Local scoped validation: common reactor compile; 30 mapping/auth tests; 19 catalog/browse tests; one real transaction rollback test; quoted-header roundtrip targeted recheck; frontend 16 mapping/panel/transfer tests, two structure tests and one image fallback test; TypeScript check. Native PR checks remain the final build gate and are tracked on PR #158; no local duplicate full-suite run.

Final code candidate `5c0649d260147b721d1d3f1873e17087ac6a29d2`: [native PR checks](https://github.com/sunshaoxuan/bobuy/actions/runs/44052070294), [CodeQL](https://github.com/sunshaoxuan/bobuy/actions/runs/44052070260), and [dependency check](https://github.com/sunshaoxuan/bobuy/actions/runs/44052070403) all SUCCESS. The following receipt-only documentation commit does not invalidate any source/dependency/configuration acceptance evidence.
