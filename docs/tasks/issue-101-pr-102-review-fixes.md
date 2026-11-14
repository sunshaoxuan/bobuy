# #101 / PR 102 review fixes

## Goal, authority and frozen scope

Repair only the four reported regressions relative to main. Commit in this worktree with existing author configuration. No push, production SSH, credentials changes or history rewriting. Preserve existing untracked files.

Paths: `.github/workflows/cd-production.yml`, `docker-compose.yml`, `scripts/publish-production.py`, its test file, `frontend/src/api.ts`, `frontend/src/components/MaintenanceNotice.test.tsx`, a focused CD regression test and this record. Direct consumers are deployment activation/recovery, the local gateway mount, publisher API freeze and SPA maintenance error handling. These are bounded corrections; deployment/recovery decisions remain with the primary agent.

## Method and acceptance

1. Move disk preflight ahead of configuration mutations. Guard edge activation, detect the running maintenance mount, and restore both configuration backups before existing six-image rollback. Preserve image selection, cleanup and SSH handling.
2. Mount the maintenance page read-only in the local gateway.
3. Recognize exactly one supported API upstream block, retain error-page directives, reject missing/ambiguous boundaries and test both checked-in nginx configurations.
4. Suppress maintenance GET error toasts, retain ordinary error/auth behavior and render the existing MaintenanceNotice. No component layout, CSS or UI guideline edits.

Minimum checks: publisher test file; focused CD mocked-shell failure scenarios plus YAML/Bash syntax; MaintenanceNotice and API authentication test files. Use existing dependencies if compatible. Browser checks, where available, cover only maintenance notice/no-toast and auth behavior at 390 and 1280px. Expected checks: a few minutes. Freeze implementation before the combined run. Reuse valid PASS; stop after required checks and commit. No full build or full suite.

## UI acceptance terms (guidelines section 8, unchanged)

功能与美观同时验收，须符合 docs/ui-ux-guidelines.md：
- 功能按本 issue 需求逐条通过，不改变未授权行为。
- 视觉与所在页面现有 UI 一致：复用已有 token 与组件，禁止原生未样式化控件，新控件与相邻控件齐高、同圆角档、间距统一。
- 具备默认 / hover / focus-visible / 选中或激活态；触控目标 ≥ 44px；键盘可操作；有可见标签或 aria-label；对比度足够。
- 四语文案（含较长的 en-US / ja-JP）在窄屏不溢出、不重叠。
- PR 附 390px 与 1280px 的改动区域截图（含关键状态）。Playwright 可用则用现有脚本或一次性检查生成。
- 主移动断点 767px 及 390px 下布局正常换行，无横向溢出。
- 只运行与本次改动相关的最小测试；PR checks 通过。

## Results

Publisher tests: 10 PASS. CD tests: 5 PASS (including five activation failure subcases). YAML and extracted Bash syntax PASS. API auth tests: 5 PASS.

Rerun reason: new MaintenanceNotice test cases called storefrontApi.trips, which bypasses fetchJson. Corrected only those new test calls to api.trips; rerun only MaintenanceNotice.test.tsx. Publisher, CD and api.test.ts PASS remain valid. No product-source change was needed for this test correction.

Production and remote PR checks are outside this local commit task. Existing notice/CSS remain unchanged; browser verification uses synthetic responses to exercise this worktree's API and existing component, with screenshots at 390 and 1280px.

Browser launch failed because the Playwright bundled headless executable is absent. Retry uses installed Chrome; no browser download or dependency installation. Only browser evidence is pending, other PASS remains valid.

MaintenanceNotice: 15 cases PASS after correcting the test entry point. Restored the pre-existing unrelated storefront 503 regression case as a separate test, preserving that API's existing behavior. Run only that restored case; other 15 cases and API auth tests remain valid.

Browser PASS: worktree Vite + installed Chrome, synthetic API responses, 390x844 and 1280x844. Notice visible, no error toast, manual retry recovers on 200, no horizontal overflow or page exceptions. Console contains only expected synthetic 503 resource errors. Existing button is 44px high, radius 22px. No layout or visible-control geometry was changed. Screenshots and browser metrics: `../reports/evidence/issue-101-pr-102-review/`. Primary visual inspection found no clipping or missing text; Gemini 3.8 Flash confirmed the mobile screenshot. Gemini 3.1 Pro request returned HTTPError, with no usable review; no claim is made about its availability beyond this request.

All four requested repairs have local evidence. CD uses command mocks, with no live deployment or production nginx execution. Publisher tests prove API block replacement and preservation for both current configs. Existing image set, cleanup and SSH credential handling remain unchanged. UI guideline file and section 8 remain unchanged by this review fix.

Final checks: restored storefront case PASS (1 run, 15 previously passed cases skipped); total relevant frontend cases 21 PASS, publisher 10 PASS, CD 5 PASS. `git diff --check` PASS. No full suites or builds. Stopped task Vite process; removed five temporary browser/model scripts and the dependency junction only, preserving its shared target, initial untracked files and final screenshot evidence. Screenshots show the existing component under synthetic responses, not a complete production page. Ready for the authorized local commit using existing author configuration.
