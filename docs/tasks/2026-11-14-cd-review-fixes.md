# CD review fixes

## Goal and scope

Fix the two reviewed issues in `.github/workflows/cd-production.yml`: preserve running image IDs under unique local rollback references, and isolate production SSH files under `RUNNER_TEMP` with unconditional cleanup. Update the corresponding deployment documentation. Do not commit or deploy. Preserve the disk preflight and unrelated behavior.

## Method and acceptance

Use `docker inspect` container image IDs and tag each with a UTC timestamp and short image ID before recording the validated reference. Create a private job-specific SSH directory, pass explicit identity and host-file options, and clean it with `if: always()`.

Frozen change scope: the workflow, its deployment documentation, and this task record. Direct consumers: remote rollback snapshot and runner SSH invocation. Validation: Python `yaml.safe_load`, extracted remote Bash script `bash -n`, and focused diff review including unchanged disk preflight. Expected duration: a few minutes. Stop after these checks pass; no builds, production access, or full-suite tests.

## Results

PASS: running image IDs are tagged with a nanosecond UTC timestamp and 12-character image ID; reference validation and local image inspection remain in place before recording rollback refs.

PASS: private SSH files use the job-specific `RUNNER_TEMP` directory, explicit identity/host-file options, strict host checking and batch mode; unconditional cleanup is present.

PASS: Python `yaml.safe_load`, extracted remote script `bash -n`, and all deploy step shell syntax checks using Git Bash. The disk preflight block matches HEAD exactly. Focused diff review and `git diff --check` passed. Documentation matches the changed behavior.

No production commands, builds, commits, or deployments were performed. No temporary validation files were created. Runtime Docker/SSH behavior was not exercised.
