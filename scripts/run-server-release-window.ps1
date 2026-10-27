param(
  [ValidateSet("auto", "local-wsl", "ssh")]
  [string]$Target = $(if ($env:RELEASE_WINDOW_TARGET) { $env:RELEASE_WINDOW_TARGET } else { "auto" }),
  [string]$SshTarget = $env:SSH_TARGET,
  [string]$AppDir = $env:APP_DIR,
  [string]$Branch = $(if ($env:BRANCH) { $env:BRANCH } else { "main" }),
  [string]$AgentAuthToken = $env:BOBBUY_AGENT_AUTH_TOKEN,
  [string]$AgentUsername = $(if ($env:BOBBUY_E2E_AGENT_USERNAME) { $env:BOBBUY_E2E_AGENT_USERNAME } else { "agent" }),
  [string]$AgentPassword = $(if ($env:BOBBUY_E2E_AGENT_PASSWORD) { $env:BOBBUY_E2E_AGENT_PASSWORD } else { "agent-pass" }),
  [string]$CodexBridgeUrl = $env:BOBBUY_AI_LLM_CODEX_BRIDGE_URL,
  [string]$CodexBridgeApiKey = $env:BOBBUY_AI_LLM_CODEX_BRIDGE_API_KEY,
  [string]$AiSecretMasterPassword = $(if ($env:BOBBUY_AI_SECRET_MASTER_PASSWORD) { $env:BOBBUY_AI_SECRET_MASTER_PASSWORD } else { [Environment]::GetEnvironmentVariable("BOBBUY_AI_SECRET_MASTER_PASSWORD", "User") }),
  [switch]$NoTemporaryLocalSecrets,
  [switch]$PrecheckOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Section {
  param([string]$Title)
  Write-Host ""
  Write-Host "== $Title =="
}

function Invoke-RemoteScript {
  param(
    [Parameter(Mandatory = $true)][string]$Script,
    [Parameter(Mandatory = $true)][AllowEmptyString()][string[]]$Arguments
  )

  $Script | & ssh $SshTarget "bash" "-s" "--" @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Remote step failed with exit code $LASTEXITCODE"
  }
}

function Test-WslAvailable {
  & wsl.exe --status *> $null
  return $LASTEXITCODE -eq 0
}

function Convert-ToWslPath {
  param([Parameter(Mandatory = $true)][string]$WindowsPath)
  if ($WindowsPath -match '^([A-Za-z]):\\(.*)$') {
    $drive = $Matches[1].ToLowerInvariant()
    $rest = $Matches[2] -replace '\\', '/'
    return "/mnt/$drive/$rest"
  }
  return $WindowsPath
}

function Invoke-WslScript {
  param(
    [Parameter(Mandatory = $true)][string]$Script,
    [Parameter(Mandatory = $true)][AllowEmptyString()][string[]]$Arguments
  )

  $Script | & wsl.exe bash "-s" "--" @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "WSL step failed with exit code $LASTEXITCODE"
  }
}

if ($Target -eq "auto") {
  if ($SshTarget) {
    $Target = "ssh"
  } elseif (Test-WslAvailable) {
    $Target = "local-wsl"
  } else {
    $Target = "ssh"
  }
}

if ($Target -eq "local-wsl" -and -not $AppDir) {
  $AppDir = Convert-ToWslPath -WindowsPath (Get-Location).Path
}

Write-Section "Release window inputs"
Write-Host ("TARGET: " + $Target)
Write-Host ("SSH_TARGET: " + $(if ($SshTarget) { "present" } else { "missing" }))
Write-Host ("APP_DIR: " + $(if ($AppDir) { $AppDir } else { "missing" }))
Write-Host ("BRANCH: " + $Branch)
Write-Host ("BOBBUY_AGENT_AUTH_TOKEN: " + $(if ($AgentAuthToken) { "present" } else { "missing; will try login after health checks" }))
Write-Host ("BOBBUY_E2E_AGENT_USERNAME: " + $(if ($AgentUsername) { "present" } else { "missing" }))
Write-Host ("BOBBUY_E2E_AGENT_PASSWORD: " + $(if ($AgentPassword) { "present" } else { "missing" }))
Write-Host ("BOBBUY_AI_LLM_CODEX_BRIDGE_URL: " + $(if ($CodexBridgeUrl) { "present" } else { "missing" }))
Write-Host ("BOBBUY_AI_LLM_CODEX_BRIDGE_API_KEY: " + $(if ($CodexBridgeApiKey) { "present" } else { "missing" }))
Write-Host ("BOBBUY_AI_SECRET_MASTER_PASSWORD: " + $(if ($AiSecretMasterPassword) { "present" } else { "missing" }))
Write-Host ("TEMPORARY_LOCAL_SECRETS: " + $(if ($Target -eq "local-wsl" -and -not $NoTemporaryLocalSecrets) { "enabled" } else { "disabled" }))

if ($Target -eq "ssh" -and -not $SshTarget) {
  Write-Host "ERROR: Missing required SSH_TARGET for ssh target. Set SSH_TARGET or use -Target local-wsl."
  exit 2
}
if (-not $AppDir) {
  Write-Host "ERROR: Missing required APP_DIR. Set APP_DIR or run from the repository root with WSL available."
  exit 2
}

$precheck = @'
set -euo pipefail
APP_DIR="$1"
BRANCH="$2"
echo "hostname=$(hostname)"
echo "date=$(date -Is)"
if test -d "$APP_DIR"; then echo "repo_dir=pass"; else echo "repo_dir=fail"; exit 20; fi
if test -f "$APP_DIR/.env"; then echo "env_file=pass"; else echo "env_file=fail"; exit 21; fi
echo "branch=${BRANCH:-main}"
'@

Write-Section "Precheck"
if ($Target -eq "local-wsl") {
  Invoke-WslScript -Script $precheck -Arguments @($AppDir, $Branch)
} else {
  Invoke-RemoteScript -Script $precheck -Arguments @($AppDir, $Branch)
}

if ($PrecheckOnly) {
  Write-Section "Precheck-only mode"
  Write-Host "Precheck completed. Full release window was not executed."
  exit 0
}

$releaseWindow = @'
set -euo pipefail
APP_DIR="$1"
BRANCH="$2"
AGENT_AUTH_TOKEN="$3"
AGENT_USERNAME="$4"
AGENT_PASSWORD="$5"
ALLOW_TEMP_LOCAL_SECRETS="$6"
CODEX_BRIDGE_URL="$7"
CODEX_BRIDGE_API_KEY="$8"
AI_SECRET_MASTER_PASSWORD="$9"

cd "$APP_DIR"
echo "step=git_update"
git fetch origin
git checkout -q "${BRANCH:-main}"
git pull --ff-only -q
echo "commit=$(git rev-parse HEAD)"
echo "server_time=$(date -Is)"

echo "step=env_required_keys"
if [ -n "$CODEX_BRIDGE_URL" ]; then
  export BOBBUY_AI_LLM_CODEX_BRIDGE_URL="$CODEX_BRIDGE_URL"
  echo "BOBBUY_AI_LLM_CODEX_BRIDGE_URL=provided_by_runner"
fi
if [ -n "$CODEX_BRIDGE_API_KEY" ]; then
  export BOBBUY_AI_LLM_CODEX_BRIDGE_API_KEY="$CODEX_BRIDGE_API_KEY"
  echo "BOBBUY_AI_LLM_CODEX_BRIDGE_API_KEY=provided_by_runner"
fi
if [ -n "$AI_SECRET_MASTER_PASSWORD" ]; then
  export BOBBUY_AI_SECRET_MASTER_PASSWORD="$AI_SECRET_MASTER_PASSWORD"
  echo "BOBBUY_AI_SECRET_MASTER_PASSWORD=provided_by_runner"
fi

if [ "$ALLOW_TEMP_LOCAL_SECRETS" = "true" ]; then
  if ! grep -q "^BOBBUY_SECURITY_JWT_SECRET=" .env || [ -z "$(grep "^BOBBUY_SECURITY_JWT_SECRET=" .env | tail -n1 | cut -d= -f2-)" ]; then
    export BOBBUY_SECURITY_JWT_SECRET="$(openssl rand -base64 48)"
    echo "BOBBUY_SECURITY_JWT_SECRET=temporary"
  fi
  if ! grep -q "^BOBBUY_SECURITY_SERVICE_TOKEN=" .env || [ -z "$(grep "^BOBBUY_SECURITY_SERVICE_TOKEN=" .env | tail -n1 | cut -d= -f2-)" ]; then
    export BOBBUY_SECURITY_SERVICE_TOKEN="$(openssl rand -hex 32)"
    echo "BOBBUY_SECURITY_SERVICE_TOKEN=temporary"
  fi
fi

required_keys="
BOBBUY_SECURITY_JWT_SECRET
BOBBUY_SECURITY_SERVICE_TOKEN
POSTGRES_PASSWORD
RABBITMQ_DEFAULT_PASS
BOBBUY_AI_LLM_CODEX_BRIDGE_URL
"
missing=0
for key in $required_keys; do
  env_value="${!key:-}"
  file_value=""
  if grep -q "^${key}=" .env; then
    file_value="$(grep "^${key}=" .env | tail -n1 | cut -d= -f2-)"
  fi
  if [ -n "$env_value" ] || [ -n "$file_value" ]; then
    echo "${key}=present"
  else
    echo "${key}=missing"
    missing=1
  fi
done
api_key_file_value=""
if grep -q "^BOBBUY_AI_LLM_CODEX_BRIDGE_API_KEY=" .env; then
  api_key_file_value="$(grep "^BOBBUY_AI_LLM_CODEX_BRIDGE_API_KEY=" .env | tail -n1 | cut -d= -f2-)"
fi
encrypted_secret_complete=1
for key in \
  BOBBUY_AI_LLM_CODEX_BRIDGE_SECRET_SALT \
  BOBBUY_AI_LLM_CODEX_BRIDGE_SECRET_NONCE \
  BOBBUY_AI_LLM_CODEX_BRIDGE_SECRET_CIPHERTEXT \
  BOBBUY_AI_LLM_CODEX_BRIDGE_SECRET_TAG
do
  value="${!key:-}"
  file_value=""
  if grep -q "^${key}=" .env; then
    file_value="$(grep "^${key}=" .env | tail -n1 | cut -d= -f2-)"
  fi
  if [ -z "$value" ] && [ -z "$file_value" ]; then
    encrypted_secret_complete=0
  fi
done
if [ -n "${BOBBUY_AI_LLM_CODEX_BRIDGE_API_KEY:-}" ] || [ -n "$api_key_file_value" ]; then
  echo "BOBBUY_AI_LLM_CODEX_BRIDGE_API_KEY=present"
elif [ "$encrypted_secret_complete" -eq 1 ] && [ -n "${BOBBUY_AI_SECRET_MASTER_PASSWORD:-}" ]; then
  echo "BOBBUY_AI_LLM_CODEX_BRIDGE_API_KEY=encrypted_present"
else
  echo "BOBBUY_AI_LLM_CODEX_BRIDGE_API_KEY=missing"
  missing=1
fi
if [ "$missing" -ne 0 ]; then
  echo "required_env=fail"
  exit 30
fi
echo "required_env=pass"

echo "step=compose_config"
docker compose config --quiet

echo "step=build_service_images"
bash scripts/build-service-images.sh </dev/null

echo "step=compose_up"
docker compose up -d --build postgres redis rabbitmq nacos nacos-init core-service ai-service im-service auth-service gateway-service frontend gateway ocr-service </dev/null
docker compose ps </dev/null

echo "step=health_checks"
curl -fsS http://127.0.0.1/api/health
curl -fsS http://127.0.0.1/api/actuator/health
curl -fsS http://127.0.0.1/api/actuator/health/readiness
curl -fsS http://127.0.0.1:8000/health

if [ -z "$AGENT_AUTH_TOKEN" ]; then
  echo "step=agent_token_login"
  if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN=python3
  elif command -v python >/dev/null 2>&1; then
    PYTHON_BIN=python
  else
    echo "python=missing"
    exit 40
  fi
  login_payload=$("$PYTHON_BIN" - "$AGENT_USERNAME" "$AGENT_PASSWORD" <<'PY'
import json
import sys
print(json.dumps({"username": sys.argv[1], "password": sys.argv[2]}))
PY
)
  login_response=$(curl -fsS -H 'Content-Type: application/json' -d "$login_payload" http://127.0.0.1/api/auth/login)
  AGENT_AUTH_TOKEN=$("$PYTHON_BIN" - <<'PY' "$login_response"
import json
import sys
payload = json.loads(sys.argv[1])
data = payload.get("data") or {}
token = data.get("accessToken") or data.get("token")
if not token:
    raise SystemExit("login response did not contain access token")
print(token)
PY
)
  echo "agent_auth_token=generated"
else
  echo "agent_auth_token=provided"
fi

echo "step=ai_sample_gate"
if command -v pwsh >/dev/null 2>&1; then
  pwsh scripts/verify-ai-onboarding-samples.ps1 -IncludeNeedsHumanGolden -AuthToken "$AGENT_AUTH_TOKEN" </dev/null
elif command -v pwsh.exe >/dev/null 2>&1; then
  pwsh.exe -NoProfile -File "$(wslpath -w scripts/verify-ai-onboarding-samples.ps1)" -IncludeNeedsHumanGolden -AuthToken "$AGENT_AUTH_TOKEN" </dev/null
elif command -v powershell.exe >/dev/null 2>&1; then
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(wslpath -w scripts/verify-ai-onboarding-samples.ps1)" -IncludeNeedsHumanGolden -AuthToken "$AGENT_AUTH_TOKEN" </dev/null
else
  powershell scripts/verify-ai-onboarding-samples.ps1 -IncludeNeedsHumanGolden -AuthToken "$AGENT_AUTH_TOKEN" </dev/null
fi

echo "step=ai_e2e"
if command -v node >/dev/null 2>&1; then
  (cd frontend && PLAYWRIGHT_BASE_URL=http://127.0.0.1 PLAYWRIGHT_SKIP_WEB_SERVER=1 RUN_AI_VISION_E2E=1 npm run e2e:ai)
elif command -v pwsh.exe >/dev/null 2>&1; then
  pwsh.exe -NoProfile -File "$(wslpath -w scripts/run-frontend-release-evidence.ps1)" -Mode ai-e2e </dev/null
elif command -v powershell.exe >/dev/null 2>&1; then
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(wslpath -w scripts/run-frontend-release-evidence.ps1)" -Mode ai-e2e </dev/null
else
  echo "node_not_found=fail"
  exit 60
fi

echo "step=mobile_blackbox"
if command -v node >/dev/null 2>&1; then
  (cd frontend && PLAYWRIGHT_BASE_URL=http://127.0.0.1 PLAYWRIGHT_SKIP_WEB_SERVER=1 RUN_REAL_MOBILE_BLACKBOX=1 npm run e2e -- e2e/mobile_customer_blackbox.spec.ts e2e/mobile_agent_blackbox.spec.ts)
elif command -v pwsh.exe >/dev/null 2>&1; then
  pwsh.exe -NoProfile -File "$(wslpath -w scripts/run-frontend-release-evidence.ps1)" -Mode mobile-blackbox </dev/null
elif command -v powershell.exe >/dev/null 2>&1; then
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(wslpath -w scripts/run-frontend-release-evidence.ps1)" -Mode mobile-blackbox </dev/null
else
  echo "node_not_found=fail"
  exit 61
fi

echo "step=postgres_restore_drill"
backup_dir="${APP_DIR}/scratch/server-release-window"
mkdir -p "$backup_dir"
docker compose exec -T postgres pg_dump -U bobbuy bobbuy </dev/null > "$backup_dir/postgres-release-window.sql"
docker compose exec -T postgres psql -U bobbuy -d postgres -c "DROP DATABASE IF EXISTS bobbuy_restore_verify;" </dev/null
docker compose exec -T postgres psql -U bobbuy -d postgres -c "CREATE DATABASE bobbuy_restore_verify;" </dev/null
docker compose exec -T postgres psql -U bobbuy -d bobbuy_restore_verify < "$backup_dir/postgres-release-window.sql"
docker compose exec -T postgres psql -U bobbuy -d bobbuy_restore_verify -c "SELECT COUNT(*) AS flyway_rows FROM flyway_schema_history;" </dev/null
docker compose exec -T postgres psql -U bobbuy -d bobbuy_restore_verify -c "SELECT COUNT(*) AS products FROM bb_product;" </dev/null

echo "step=postgres_image_restore_probe"
docker compose exec -T postgres sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -Atc "SELECT count(*),coalesce(sum(octet_length(content)),0) FROM bb_recommendation_image"' </dev/null
echo "postgres_image_restore_probe=pass"

echo "step=nacos_archive_probe"
nacos_archive="$backup_dir/nacos-config-archive.txt"
docker compose logs --no-color nacos-init > "$nacos_archive"
test -s "$nacos_archive"
echo "nacos_archive=$nacos_archive"

echo "release_window=pass"
'@

Write-Section "Full server release window"
if ($Target -eq "local-wsl") {
  $allowTemporaryLocalSecrets = if ($NoTemporaryLocalSecrets) { "false" } else { "true" }
  Invoke-WslScript -Script $releaseWindow -Arguments @($AppDir, $Branch, $AgentAuthToken, $AgentUsername, $AgentPassword, $allowTemporaryLocalSecrets, $CodexBridgeUrl, $CodexBridgeApiKey, $AiSecretMasterPassword)
} else {
  Invoke-RemoteScript -Script $releaseWindow -Arguments @($AppDir, $Branch, $AgentAuthToken, $AgentUsername, $AgentPassword, "false", $CodexBridgeUrl, $CodexBridgeApiKey, $AiSecretMasterPassword)
}
