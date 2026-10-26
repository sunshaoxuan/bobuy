# Dependency audit reliability, 2026-10-26

## Original run terminal evidence

[Run 40372651999](https://github.com/sunshaoxuan/bobuy/actions/runs/40372651999), source `93abb352419cc71e0ec31fadeacc118969dfea01`, completed **success** at 18:23:00 UTC after 1,842 seconds. The report artifact exists (ID 12676575259). This is its actual GitHub conclusion, not a claim that dependencies are safe or the scan is complete.

Its engine 12.1.8 downloaded roughly 414,000 NVD records without a restored dedicated data cache. It logged failed DB writes for CVE-2026-6785 and CVE-2026-6786: their reference URLs exceeded the 1,000-character column. It nevertheless completed analysis and returned zero. The report scans 117 dependencies; 18 have findings, with 31 CRITICAL, 64 HIGH, 72 MEDIUM and eight LOW **occurrences**, including shaded/duplicate records. Reachability/false-positive triage and deduplication have not been completed. This report must not be called a clean security pass. Original HTML/JSON, scan.log and summary.json remain in `evidence/dependency-audit-40372651999/`.

## Bounded fix

Use scanner 12.2.2, whose [official change log](https://github.com/dependency-check/DependencyCheck/blob/main/CHANGELOG.md#version-1222-2026-05-03) explicitly fixes the [long reference URL defect #8466](https://github.com/dependency-check/DependencyCheck/issues/8466). No application dependency version changes. Both existing audit routes use the same Bash runner, keeping each route's prior runtime-only/default scope. Existing CVSS policy and error rejection are not lowered. NVD keys are referenced by environment-variable name, never placed in Maven argv.

Add a version-separated explicit database directory/cache, retain automatic data updates with a four-hour freshness check, and cap the job at 45 minutes instead of an unbounded hours-long wait. No credentials or new paid feed is created. The first trustworthy database seed can still take time; subsequent compatible runs restore the updated database instead of re-downloading all history. Do not reuse the original partial 12.1.8 database.

Use the [documented `odc.outputDirectory` Maven property](https://dependency-check.github.io/DependencyCheck/dependency-check-maven/check-mojo.html#outputDirectory), with an absolute report directory and consistent artifact path. The original `-DoutputDirectory` argument was ignored, as confirmed by its logs writing to backend/target instead of the requested /tmp path. Require both nonempty HTML/JSON reports. Reject logged per-CVE data processing failures even when the engine exits zero; pipefail preserves real Maven failures through tee.

## Validation / delivery

Five behavior tests PASS: complete reports, explicit runtime scope, Maven failure propagation, partial-CVE data rejection and missing-report rejection; the dummy NVD key never appears in argv/output. Bash syntax PASS. Existing SnakeYAML parses both workflows and checks cache/shared-runner/timeout binding. No application build, migration, content write or production deployment is required for this CI-only batch; the authentic .6 application acceptance remains unchanged. After committing these files, run only the corrected dependency workflow once and follow it to its actual conclusion; do not repeat the entire application CI.

Corrected real scan: pending execution/receipt. Runtime production remains 20261026.6 / `93abb352`.
