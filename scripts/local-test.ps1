param([ValidateSet('start', 'stop', 'status')][string]$Action = 'start')
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$compose = Join-Path $root 'compose.local.yml'
switch ($Action) {
    start {
        & mvn -f (Join-Path $root 'backend/pom.xml') -DskipTests package
        if ($LASTEXITCODE) { throw 'Backend build failed' }
        Push-Location (Join-Path $root 'frontend')
        try { & npm run build; if ($LASTEXITCODE) { throw 'Frontend build failed' } } finally { Pop-Location }
        & docker compose --project-name bobuy-local --file $compose up --detach --build
    }
    stop { & docker compose --project-name bobuy-local --file $compose stop }
    status { & docker compose --project-name bobuy-local --file $compose ps }
}
if ($LASTEXITCODE) { throw 'Compose operation failed' }
