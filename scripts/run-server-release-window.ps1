param(
  [ValidateSet("auto", "local-wsl", "ssh")]
  [string]$Target = $(if ($env:RELEASE_WINDOW_TARGET) { $env:RELEASE_WINDOW_TARGET } else { "auto" }),
  [string]$SshTarget = $env:SSH_TARGET,
  [string]$AppDir = $env:APP_DIR,
  [string]$Branch = $(if ($env:BRANCH) { $env:BRANCH } else { "main" }),
  [switch]$PrecheckOnly,
  [switch]$AllowFullSnapshot,
  [string]$MaintenanceReason
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $PrecheckOnly -and (-not $AllowFullSnapshot -or [string]::IsNullOrWhiteSpace($MaintenanceReason))) {
  throw 'Full release window requires -AllowFullSnapshot and -MaintenanceReason. For additive reference data use publish-production.py --mode reference-data with a reviewed plan.'
}

if (-not $PrecheckOnly) {
  throw 'Retired full release window. Use the scoped production release process; this entry now supports -PrecheckOnly only.'
}

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
