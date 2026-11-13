# Pull request checks

## Scope and focused acceptance

This change only adds the lightweight pull-request workflow, the frontend commands it invokes, and this operator note. The focused validation is YAML parsing, frontend lint/type-check command execution, and inspection of the path filters; it does not run Playwright, integration tests, deployment, or unrelated project-wide checks.

## Runner selection

The `PR checks` workflow uses GitHub-hosted `ubuntu-latest` runners by default. To use a self-hosted runner, create the repository Actions variable `CI_RUNNER` under **Settings → Secrets and variables → Actions → Variables**, and set it to a matching runner label such as `self-hosted`. Remove the variable or leave it empty to return to `ubuntu-latest`.

For a public repository using self-hosted runners, configure **Settings → Actions → General → Fork pull request workflows** so that **all external contributors require approval** before their workflows run. This prevents unreviewed fork code from executing on the self-hosted machine.

The workflow only reads repository contents. It does not use secrets, deploy, run Playwright E2E, upload artifacts, or alter the existing CodeQL and dependency-scanning workflows. Backend paths select Maven compilation and unit tests; frontend paths select lint, type-checking, Vitest, and the production build.
