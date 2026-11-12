$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../../../..')).Path
if ((Split-Path $taskRoot -Leaf) -ne 'product-introductions-20261112') { throw 'Unexpected task workspace' }
$events = [Collections.Generic.List[object]]::new()
$owned = @(
    @{ Id=94828; Name='node.exe'; Pattern='\sworksheet\.mjs$' },
    @{ Id=95228; Name='node.exe'; Pattern='\sevidence-bridge\.mjs$' },
    @{ Id=44216; Name='node.exe'; Pattern='\saudit-worksheet\.mjs$' },
    @{ Id=99724; Name='java.exe'; Pattern='-jar backend/target/bobbuy-backend-0\.1\.0\.jar .*--server\.port=18086 .*--spring\.profiles\.active=test' },
    @{ Id=86080; Name='node.exe'; Pattern=([regex]::Escape($taskRoot)+'.*vite.*--port 4189$') },
    @{ Id=92548; Name='node.exe'; Pattern=([regex]::Escape($taskRoot)+'.*vite.*--port 4190$') }
)
foreach ($entry in $owned) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($entry.Id)"
    if (!$process) { $events.Add(@{process=$entry.Id;result='already absent'}); continue }
    if ($process.Name -ne $entry.Name -or $process.CommandLine -notmatch $entry.Pattern) { throw "Process identity changed: $($entry.Id)" }
    Stop-Process -Id $entry.Id
    Wait-Process -Id $entry.Id -Timeout 10 -ErrorAction SilentlyContinue
    if (Get-Process -Id $entry.Id -ErrorAction SilentlyContinue) { throw 'Owned process still running' }
    $events.Add(@{process=$entry.Id;result='stopped exact task process'})
}
function Remove-TaskDirectory([string]$relative) {
    $path = [IO.Path]::GetFullPath((Join-Path $taskRoot $relative))
    if (!$path.StartsWith($taskRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Directory outside task workspace' }
    if (!(Test-Path -LiteralPath $path)) { return }
    $item = Get-Item -LiteralPath $path -Force
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Recursive removal refuses reparse point' }
    $resolved = (Resolve-Path -LiteralPath $path).Path
    if (!$resolved.StartsWith($taskRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Resolved directory outside workspace' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
    $events.Add(@{path=$relative;result='removed task temporary directory'})
}
foreach ($relative in @('__pycache__','scripts/__pycache__','backend/target','bobbuy-common/target','bobbuy-core/target','frontend/dist','.task-tmp/release-payload','.task-tmp/frontend-currency','docs/reports/evidence/product-introductions-20261112/sources','docs/reports/evidence/product-introductions-20261112/draft-batches')) { Remove-TaskDirectory $relative }
$junctionPath = Join-Path $taskRoot 'frontend/node_modules'
if (Test-Path -LiteralPath $junctionPath) {
    $junction = Get-Item -LiteralPath $junctionPath -Force
    if ($junction.LinkType -ne 'Junction') { throw 'Dependency path is not the owned junction' }
    $target = [string]@($junction.Target)[0]
    if (!(Test-Path -LiteralPath $target -PathType Container)) { throw 'Dependency target missing before unlink' }
    [IO.Directory]::Delete($junction.FullName)
    if (!(Test-Path -LiteralPath $target -PathType Container)) { throw 'Shared dependency target changed' }
    $events.Add(@{path='frontend/node_modules';result='unlinked own junction; shared target preserved'})
}
$coveragePath = [IO.Path]::GetFullPath('C:/workspace/codex-work/bobuy-product-introductions-20261112')
if (Test-Path -LiteralPath $coveragePath) {
    $resolved = (Resolve-Path -LiteralPath $coveragePath).Path
    if ($resolved -ne 'C:\workspace\codex-work\bobuy-product-introductions-20261112' -or (Get-Item -LiteralPath $resolved).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Unexpected coverage temporary path' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
    $events.Add(@{path='task-specific ASCII coverage/TEMP directory';result='removed'})
}
$temporaryFiles = @('archive-additions.mjs','assemble-drafts.mjs','audit-worksheet.mjs','build-evidence.py','crop-evidence.py','editorial-facts.json','evidence-bridge.mjs','finalize-records.py','frontend-release.py','inspect-research.mjs','inventory.mjs','manual-additions.json','pending.mjs','prepare-batches.mjs','public-acceptance.py','release-client.py','research-groups.mjs','research.mjs','review-drafts.mjs','runtime-current.py','source-example.html','worksheet.mjs')
foreach ($name in $temporaryFiles) {
    $path = Join-Path $taskRoot $name
    if (Test-Path -LiteralPath $path -PathType Leaf) { Remove-Item -LiteralPath $path -Force; $events.Add(@{path=$name;result='removed task helper'}) }
}
foreach ($file in Get-ChildItem -LiteralPath $PSScriptRoot -File) {
    if ($file.Name -match '^candidate-(direct|raw)-' -or $file.Name -match '^candidate-.*-native\.png$' -or $file.Name -match '^production-.*-info\.jpg$' -or $file.Name -eq 'production-zh-CN-360-native.jpg' -or $file.Name -eq 'production-en-US-360-top.jpg' -or $file.Name -in @('local-frontend.log','local-runtime.log','draft-prompt.txt')) {
        Remove-Item -LiteralPath $file.FullName -Force
        $events.Add(@{path=$file.Name;result='removed superseded process evidence'})
    }
}
$value = @{result='PASS';events=$events;preserved='formal deliverables and ignored original evidence, isolated worktree, shared dependencies, unrelated root work and remote rollback artifacts'}
$value | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'cleanup.json') -Encoding utf8
Write-Output 'Task-owned local cleanup completed'
