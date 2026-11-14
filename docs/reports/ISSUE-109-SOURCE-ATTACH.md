# Issue #109 / PR #110 source attachment fixes

## Goal and scope
On branch `issue-109-source-hash-autofill`, allow an owner reviewing UNKNOWN posts such as #11/#12 to enter a date and source reference, attach raw MIME or HTML, receive a server-computed read-only SHA-256, confirm review and save. Preserve historical hashes and published #07/#09 data. No mailbox fetching, production scripts, deployment, history rewriting or unrelated refactors.

## Implementation and bounded validation plan
- Authenticated owner-scoped source preview and upload endpoints; immutable raw-byte artifact storage, 1..10MiB, accepted MIME/HTML file types, metadata-only responses.
- Editor and API binding: draft-reference lookup, upload, shared effective-hash validation, stale response protection, confirmation reset, four locales, Ant Design controls.
- Transition-safe V36 migration for old writes with omitted algorithm, preserving historical evidence.
- Direct consumers: issue-date service/controller, editor/panel/API and locale resources. Focused service/controller/integration/migration tests, editor/panel tests and TypeScript check; browser flow and screenshots at 390×844 and 1280×800 using synthetic data only. No full product suite or new Docker stack.
- Estimated checks: unit/UI 2–5 minutes, available integration/browser 5–10 minutes. Track existing processes; stop when scoped acceptance is complete. Record blockers explicitly. Commit with conventional message; no push required.

## UI budgets and acceptance
Attach button target >=44px, adjacent action gap >=6px, glyph clearance >=3px, center deviation <=min(2px, 10% glyph height). Preserve current editor layout/tokens, wrap long source/hash text and localizations at 390px; source changes reset confirmation. Inspect full runtime capture and original-size changed-region crops before visual PASS.

功能与美观同时验收，须符合 docs/ui-ux-guidelines.md：
- 功能按本 issue 需求逐条通过，不改变未授权行为。
- 视觉与所在页面现有 UI 一致：复用已有 token 与组件，禁止原生未样式化控件，新控件与相邻控件齐高、同圆角档、间距统一。
- 具备默认 / hover / focus-visible / 选中或激活态；触控目标 ≥ 44px；键盘可操作；有可见标签或 aria-label；对比度足够。
- 四语文案（含较长的 en-US / ja-JP）在窄屏不溢出、不重叠。
- PR 附 390px 与 1280px 的改动区域截图（含关键状态）。Playwright 可用则用现有脚本或一次性检查生成。
- 主移动断点 767px 及 390px 下布局正常换行，无横向溢出。
- 只运行与本次改动相关的最小测试；PR checks 通过。

## Evidence and final acceptance

| Required behavior/check | Result | Evidence |
| --- | --- | --- |
| Owner-only upload, raw bytes and hash, immutable retry/conflict, file type/10MiB boundary | PASS | 14 service tests and 5 controller tests |
| UNKNOWN upload, draft preview, save without sourceHash, GET reopen, authorization and public non-disclosure | PASS | 5 API integration tests using isolated synthetic H2 data |
| Old-style hash UPDATE omitting algorithm immediately after V36; historical hash retained | PASS | 1 migration test executes actual V36, H2 PostgreSQL mode with timestamptz alias |
| Draft lookup, effective hash, file/ref confirmation reset, stale responses, parent state and API transport | PASS | 79 frontend tests (editor 46, panel 16, page 6, API 11) |
| TypeScript | PASS | `node node_modules/typescript/bin/tsc --noEmit` |
| Four locales | PASS | `node scripts/check-i18n.mjs`: 1717 keys, application references and negative fixture |
| Browser function, console/network, responsive screenshots, pixel/visual review | NOT COMPLETED | Browser access host unavailable; no visual PASS or screenshots claimed |
| PostgreSQL engine/Flyway deployment and actual pending #11/#12 | NOT RUN | No production access or changes; migration test uses H2 |

Backend command: Maven 3.9.9, JDK 22, `-o -f backend/pom.xml -Dtest=RecommendationIssueDateServiceTest,RecommendationIssueDateControllerTest,RecommendationIssueDateIntegrationTest,RecommendationSourceArtifactMigrationTest test`. Failed controller/fixture checks were corrected and rerun only as documented below. Final migration check passed at 2026-11-14 19:31 JST.

Frontend: the standard four-file Vitest command was blocked before collection. A disposable runner invoked the same Vitest 1.6.1 suites, jsdom and `src/test/setup.ts`, using TypeScript `transpileModule` (ES2020/ESNext/react-jsx), Vite `esbuild:false`, `resolve.preserveSymlinks:true`, and one thread. All 79 tests passed in 47.81s. No product tooling, dependency versions or test assertions were weakened. Standard Vite/browser execution still needs an environment that supports subprocesses.

Implementation is retained in the working tree with the browser acceptance gap explicitly retained. Overall UI acceptance remains incomplete. No push, production migration, live data modification or external mailbox access.

## Execution notes and bounded recovery

External advice: live model discovery succeeded; Claude request returned no available accounts, DeepSeek model discovery connection refused. Primary agent continues implementation and review. PowerShell preflight skill used for the bounded discovery script; no credentials printed.

Dependency setup: offline npm ci reached lifecycle execution and failed with OS `spawn EPERM`. Recovery is limited to completing dependencies with lifecycle scripts disabled; no product dependency changes or repeated clean install. Subsequent tests must report actual runtime results.

The incremental npm install needs missing registry metadata; lockfile-based offline ci with `--ignore-scripts` is the minimal recovery for that failed setup. Candidate paths are the issue-date service/controller, additive V37 migration, multipart size envelope, frontend editor/panel/API/locales/CSS, focused tests and these documents. Backend focused test process started once; frontend tests include editor, panel, page direct consumer and API binding. Browser acceptance remains restricted to this editor. No native commit hooks are configured in this checkout.

First backend run: service 14 PASS, API integration 5 PASS; controller missing-file case returned 500, migration fixture lacked H2's timestamptz alias. Minimal corrections: route missing file through service validation, add H2 domain alias in test only. Rerun controller + migration tests, retain service and integration PASS (multipart success route unchanged).

Frontend TypeScript and i18n checks PASS. Standard focused Vitest launch blocked before tests by esbuild subprocess `spawn EPERM`; no test PASS claimed from that launch.

Scoped runner uses the same Vitest/jsdom test files and installed TypeScript in-process transpilation (no repository build/test configuration changes). Its first collection hit Vite Windows realpath `net use` subprocess EPERM; `preserveSymlinks:true` avoids that unnecessary drive discovery in this checkout. Only the four unexecuted focused suites are retried.

Final scope correction: acceptance explicitly requires old writes immediately after V36. Change this PR's new V36 to omit the incompatible paired CHECK; remove proposed V37. This changes migration evidence only: rerun `RecommendationSourceArtifactMigrationTest` against the final V36. Retain 14 service, 5 controller and 5 API integration PASS plus 79 frontend tests, TypeScript and 1717-key i18n PASS. No deployed schema/checksum repair is authorized or performed.

Browser inventory returned `The browser access host is unavailable`. Runtime screenshots, browser console/network, responsive geometry and Gemini screenshot review remain NOT COMPLETED; overall UI acceptance is not claimed. The local component/browser integration gap must be checked in a browser-enabled environment.

Codex self-improvement skill reviewed for the repeated environment failure: the verified task-local adaptation is in-process TypeScript transformation plus preserved symlink resolution for this Windows sandbox. This is an observation only, with no global skill installation or memory changes; the designated external learning directory is outside this task's writable scope. Normal environments should retain the existing standard runner.

Cleanup: removed task-owned temporary discovery/test scripts, installed frontend dependencies and backend build/test output after recording results here. Source, tests and formal documents retained.

Commit BLOCKED: `git add` failed before staging with `Unable to create .../.git/index.lock: Permission denied`. The session grants read-only access to `.git` and no elevation. No history or index changes made. Intended conventional commit: `fix(recommendations): attach source files for issue-date review`. Requires a Git-writable session to stage and commit these 22 files; no additional functional rerun is needed solely for committing.
