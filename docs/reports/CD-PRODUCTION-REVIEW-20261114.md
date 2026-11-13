# Production CD review repair

Scope: `.github/workflows/cd-production.yml` and `docs/continuous-deployment.md`.
No commit, deployment, host mutation, application changes or full product tests.
Use the user's verified host layout and the repository publisher/nginx configuration.

Acceptance: HTTPS root and `/health` require 200 without redirects; pull/up,
container health and nginx failures enter rollback; capture all six running image
refs before switching, including the first CD run; recover using local images.
Compose uses `/etc/bobuy.env`, project `bobuy`, the existing production files and
optional RustFS file, plus a CD override; scope pull/up to six apps with no deps.
Never mutate the environment file. Use SSH stdin for the job token, isolated
temporary Docker credentials and logout after pull. Keep host verification,
fork guard, production environment, concurrency and manual dispatch. Exclude
host-only configuration changes and document the manual publisher boundary.

Method: inspect existing files, implement one bounded batch, validate YAML and
extracted Bash, then exercise the remote script using mocked Docker/curl commands.
Expected validation time: under two minutes. Stop once focused checks pass.
Only changed script inputs or a specific failed assertion warrant a repeat.

Evidence: `infra/nginx/bobuy.conf` maps HTTPS `/health` to gateway `/api/health`;
`scripts/publish-production.py` waits for backend health and executes nginx test
then reload after recreation and rollback. Host facts supplied by the user are
the production baseline; this task does not independently contact production.

Validation completed locally:

- PASS: PyYAML `safe_load` for the workflow and `git diff --check`.
- PASS: Git Bash `bash -n` for every workflow run block and extracted remote script.
- PASS: eight mocked remote executions: success, pull failure, up failure, login
  failure, nginx validation failure, HTTP 301, failed rollback and missing env.
  Assertions covered six-service scope, optional RustFS inclusion, captured local
  refs, rollback override identity, failure exit status, nginx test/reload,
  HTTPS endpoint use, unchanged environment file and credential cleanup.
- PASS: final source review retains concurrency, production environment, fork
  guards, manual dispatch and verified SSH host keys. Configuration-only triggers
  and manual configuration publication are documented. No unrelated files changed.

The fixture used dummy credentials and mocked Docker/curl; it does not establish
live Docker, GHCR, SSH or production health. No production connection, deployment
or commit was performed. Task-only fixtures were removed after validation.
All seven requested fixes are locally accepted; live execution remains untested.
