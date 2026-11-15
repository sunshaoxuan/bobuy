# Issue 142: picker review correction

## Goal and scope
Fix the P2 finding on `hide-empty-trip-status-card` for PR #144. Preserve the entire-card removal when no real trip exists, including its spacing, and retain real trip information. Keep trip routes and #126 / #128 / #137 behavior. Work only in this checkout; local commit only, with no push or new PR.

## Implementation and frozen verification plan
Small local change owned by the primary agent. Paths: `frontend/src/pages/Storefront.tsx`, `frontend/src/pages/StorefrontContext.test.tsx`, and this record. Share picker availability between the trigger, rendered Drawer and effective open state; clear stale open intent when choices disappear. Catalog and recommendation pause props consume the effective state.

Focused acceptance: empty card absent in all four languages; in-progress-only card retained with disabled trigger and unpaused catalog; bookable picker opens, pauses and closes normally; pending choices ignore clicks and becoming available does not open stale intent. Preserve existing related context tests.

Checks: StorefrontContext Vitest file, frontend typecheck, diff whitespace check, and a bounded Playwright availability check. Estimated 1 to 3 minutes for automated checks. No dependency installation, full suite, build, Docker stack or unrelated checkout access. If browser execution is unavailable, record the actual limitation. Stop after this bounded set, then commit locally.

## UI acceptance terms (docs/ui-ux-guidelines.md section 8)
功能与美观同时验收，须符合 docs/ui-ux-guidelines.md：
- 功能按本 issue 需求逐条通过，不改变未授权行为。
- 视觉与所在页面现有 UI 一致：复用已有 token 与组件，禁止原生未样式化控件，新控件与相邻控件齐高、同圆角档、间距统一。
- 具备默认 / hover / focus-visible / 选中或激活态；触控目标 ≥ 44px；键盘可操作；有可见标签或 aria-label；对比度足够。
- 四语文案（含较长的 en-US / ja-JP）在窄屏不溢出、不重叠。
- PR 附 390px 与 1280px 的改动区域截图（含关键状态）。Playwright 可用则用现有脚本或一次性检查生成。
- 主移动断点 767px 及 390px 下布局正常换行，无横向溢出。
- 只运行与本次改动相关的最小测试；PR checks 通过。

The existing card geometry and styles are retained. Browser checks, when available, use 390×844 and 1280×800; existing 44px hit area and 3px glyph inset budgets apply. No visual PASS is inferred from unit tests.

## Results
Implementation complete. All picker entry points use availability; Drawer and all direct autoPaused consumers use effective open state. Existing card rendering and routes are retained.

Validation attempt: focused Vitest could not load configuration because esbuild process creation failed with spawn EPERM; no tests executed. Initial typecheck found unsupported Array.at in the new tests.

Rerun reason: replace Array.at with the existing slice(-1)[0] convention; affected check is frontend typecheck, command npm.cmd run typecheck. Vitest has an unchanged process-launch blocker and will not be retried. Static review also aligned the two product-driven picker entry points with the same availability condition before the final typecheck.

Final evidence:
- PASS: npm.cmd run typecheck --prefix frontend (exit 0 after compatibility correction).
- PASS: git diff --check.
- BLOCKED: npm.cmd test -- src/pages/StorefrontContext.test.tsx, esbuild spawn EPERM before test execution.
- BLOCKED: Playwright chromium.launch, spawn EPERM. No screenshots, responsive checks, console/network browser checks, geometry measurements or Gemini screenshot review were produced. Visual acceptance remains unverified.
- Added focused cases for in-progress-only repeated trigger clicks and unpaused catalog, plus pending-to-bookable availability and explicit open/close pause behavior. Retained four-language empty-container removal and real-trip visibility cases.
- Static final review: all picker entry points share availability; Drawer and pause props share effective open state. Routes, card visibility condition and existing layout styles remain intact. No changes to category-tree, registration or other clones.
- Overall runtime acceptance remains incomplete because the focused test runner and browser cannot launch in this environment. Local commit is requested by the user with these limitations recorded.

Local commit attempt failed: git add and git commit could not create .git/index.lock (Permission denied). Changes remain unstaged on hide-empty-trip-status-card. HEAD remains 100abd5bac119115b764c87a37436f272ad65449; no push or new PR.
