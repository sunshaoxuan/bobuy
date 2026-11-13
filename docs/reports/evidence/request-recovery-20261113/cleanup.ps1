[CmdletBinding()]
param([ValidateSet('Prepare','Run')][string]$Mode = 'Prepare')
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
if (-not $taskRoot.EndsWith('\.task-tmp\request-recovery-20261113')) { throw 'Unexpected task root' }
$manifestPath = Join-Path $PSScriptRoot 'cleanup-manifest.json'
$distRoot = Join-Path $taskRoot 'frontend/dist'
$tempRoot = Join-Path $taskRoot '.task-tmp/request-recovery'
$artifact = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'artifact.json') -Raw | ConvertFrom-Json
function Assert-Path([string]$Path) {
    $absolute = [IO.Path]::GetFullPath($Path)
    if (-not $absolute.StartsWith($taskRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Path escapes task root' }
    $part = $absolute
    while ($part.Length -ge $taskRoot.Length) {
        $item = Get-Item -LiteralPath $part -Force
        # OneDrive cloud reparse points are allowed. Symbolic links and junctions are excluded.
        if ($item.LinkType) { throw 'Linked path excluded from cleanup' }
        if ($part -eq $taskRoot) { break }
        $part = Split-Path -Parent $part
    }
}
if ($Mode -eq 'Prepare') {
    Assert-Path $distRoot
    Assert-Path $tempRoot
    $tracked = git -C $taskRoot ls-files -- frontend/dist .task-tmp/request-recovery
    if ($LASTEXITCODE -ne 0 -or $tracked) { throw 'Tracked cleanup target' }
    $files = @()
    foreach ($entry in $artifact.frontend.PSObject.Properties) {
        $file = Join-Path $distRoot $entry.Name
        $item = Get-Item -LiteralPath $file -Force
        $files += [pscustomobject]@{ path=$item.FullName; sha256=$entry.Value; bytes=$item.Length }
    }
    foreach ($file in @((Join-Path $tempRoot 'payload.tar.gz'),(Join-Path $PSScriptRoot 'visual-baseline.log'))) {
        $item = Get-Item -LiteralPath $file -Force
        $files += [pscustomobject]@{ path=$item.FullName; sha256=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash; bytes=$item.Length }
    }
    $directories = @((Get-ChildItem -LiteralPath $distRoot -Directory -Recurse -Force).FullName) + @($distRoot,$tempRoot)
    $protected = @()
    foreach ($file in @('artifact.json','local-browser.json','production-browser.json','production-verify.json','production-recovered-desktop.png','production-recovered-mobile.png','tests.log','paging-tests.log','build.log')) {
        $path = Join-Path $PSScriptRoot $file
        $protected += [pscustomobject]@{ path=$path; sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash }
    }
    [pscustomobject]@{ taskRoot=$taskRoot; remoteRecovery='/opt/bobuy/releases/20261113.read-recovery.1'; files=$files; directories=$directories; protected=$protected } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $manifestPath -Encoding utf8
    Write-Output ('Frozen exact cleanup manifest: ' + $files.Count + ' files')
    return
}
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($manifest.taskRoot -ne $taskRoot) { throw 'Wrong manifest root' }
$listed = @($manifest.files.path)
foreach ($path in @((Get-ChildItem -LiteralPath $distRoot -File -Recurse -Force).FullName) + @((Get-ChildItem -LiteralPath $tempRoot -File -Recurse -Force).FullName)) {
    if ($path -notin $listed) { throw 'Unexpected file in cleanup root' }
}
foreach ($directory in $manifest.directories) { Assert-Path $directory }
foreach ($entry in $manifest.protected) {
    if ((Get-FileHash -LiteralPath $entry.path -Algorithm SHA256).Hash -ne $entry.sha256) { throw 'Protected evidence changed' }
}
$bytes = 0
foreach ($entry in $manifest.files) {
    Assert-Path $entry.path
    $item = Get-Item -LiteralPath $entry.path -Force
    if ($item.PSIsContainer -or $item.Length -ne $entry.bytes -or (Get-FileHash -LiteralPath $entry.path -Algorithm SHA256).Hash -ne $entry.sha256) { throw 'Temporary file changed' }
    Remove-Item -LiteralPath $entry.path -Force
    $bytes += $entry.bytes
}
foreach ($directory in ($manifest.directories | Sort-Object Length -Descending)) {
    if (@(Get-ChildItem -LiteralPath $directory -Force).Count) { throw 'Unexpected directory contents remain' }
    Remove-Item -LiteralPath $directory -Force
}
foreach ($entry in $manifest.protected) {
    if ((Get-FileHash -LiteralPath $entry.path -Algorithm SHA256).Hash -ne $entry.sha256) { throw 'Protected evidence changed after cleanup' }
}
foreach ($entry in $manifest.files) { if (Test-Path -LiteralPath $entry.path) { throw 'Temporary file remains' } }
[pscustomobject]@{ result='PASS'; removedFiles=$manifest.files.Count; removedBytes=$bytes; protectedEvidence=$manifest.protected.Count; sharedDependencies='Retained'; remoteRollback='Retained'; at=(Get-Date -Format o) } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'cleanup.json') -Encoding utf8
Get-Content -LiteralPath (Join-Path $PSScriptRoot 'cleanup.json')
