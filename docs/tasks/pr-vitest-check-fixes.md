# PR Vitest check fixes

## Authorized scope

Repair the five frontend test files reported by the PR check without skipping or deleting tests. No deployment is authorized or required.

## Changes and minimum verification

- Keep the Node-native SEO suite out of Vitest collection; verify the targeted Vitest command and the dedicated SEO command.
- Restore the price-adjustment document entry asserted by `referenceOfferWindow.test.tsx`; verify that targeted component test.
- Make the maintenance-response fixtures compatible with the public-read retry policy while retaining their message assertions; verify that targeted component test.
- Re-run the two reported recommendation/date suites in the same targeted Vitest invocation because their CI failures are part of the authorized acceptance set.

## Review follow-up (2026-11-14)

Goal: resolve the three review findings with minimal changes, preserving all tests. Do not commit or deploy.

Frozen scope: `frontend/vitest.config.ts`, `frontend/vite.config.ts`, `.github/workflows/pr-check.yml`, `frontend/src/components/RecommendationFacts.tsx`, `frontend/src/referenceOfferWindow.test.tsx`, and this record.

Method and acceptance:
- Move the Node SEO exclusion into the active Vitest config, preserving existing exclusions and Vitest defaults. Remove the ineffective Vite test block.
- Grant the paths-filter job contents/read and pull-requests/read permissions.
- Point the existing facts link to `/admin/products`. App routes this to ProductArchive, whose StockMaster pricing action opens ProductPricingPanel and PriceAdjustmentWorkspace. Update its existing assertion; no layout or styling changes.
- Run the requested `npx vitest run src/referenceOfferWindow.test.tsx scripts/home-seo.test.mjs --passWithNoTests` and `npm run typecheck` from frontend. Run `npm run check:seo` to verify the excluded suite with its intended runner. Check the scoped diff for whitespace and unintended edits.

Expected validation time: under three minutes. Stop after these checks pass; investigate only failures affecting this scope. No full builds, broad tests, new stack, external model review, commit, or deployment. These are bounded config and link corrections handled directly by the primary agent.

Initial validation: all three commands failed at startup because local frontend dependencies were absent (Vitest/plugin-react, test types, and jsdom). `npx` fetched a non-project Vitest but could not load the local config. Installing the existing lockfile with `npm ci --no-audit --no-fund` repairs this prerequisite.

Rerun basis: restored local dependencies invalidate the startup failures; rerun only the three commands above. No prior PASS exists to reuse.

Final results:
- PASS: requested Vitest command, project Vitest 1.6.1, 1 file and 4 tests passed; Node SEO file excluded from Vitest collection.
- PASS: `npm run typecheck`, exit 0.
- PASS: `npm run check:seo`, 3 tests passed, 0 skipped.
- PASS: scoped diff review and whitespace check. Existing exclusions retained, no tests removed or skipped, pricing route chain confirmed in source, job permissions scoped to paths-filter.
- Workflow permission indentation and values reviewed directly. Optional YAML parser check could not start because js-yaml is not installed; no new dependency added. GitHub CI execution is not verified locally.
- Browser navigation was not exercised; this patch changes only the existing link destination, with its rendered href covered by the targeted test and route reachability checked in source. No visual layout changes.
- No commit, deployment, broad regression, or new runtime stack. Dependency installation retained for this checkout; no temporary task files created.
