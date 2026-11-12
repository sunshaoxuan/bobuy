param([Parameter(Mandatory=$true)][string]$TaskRoot)
$ErrorActionPreference = 'Stop'
$resolvedTask = (Resolve-Path -LiteralPath $TaskRoot).Path
if ((Split-Path -Leaf $resolvedTask) -ne 'editor-layout-20261112' -or (Split-Path -Leaf (Split-Path -Parent $resolvedTask)) -ne '.task-tmp') { throw 'Unexpected task root' }
if (-not (Test-Path -LiteralPath (Join-Path $resolvedTask '.git') -PathType Leaf)) { throw 'Expected isolated worktree' }
$evidenceRoot = Join-Path $resolvedTask 'docs/reports/evidence/editor-layout-20261112'
$removed = @(); $stopped = @()
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -match [regex]::Escape($resolvedTask) -and $_.CommandLine -match 'vite.+--port (5187|4187)' } | ForEach-Object { Stop-Process -Id $_.ProcessId; $stopped += $_.ProcessId }
$junctionPath = Join-Path $resolvedTask 'frontend/node_modules'
if (Test-Path -LiteralPath $junctionPath) {
  $junctionItem = Get-Item -LiteralPath $junctionPath -Force
  if ($junctionItem.LinkType -ne 'Junction') { throw 'Refusing non-junction dependency removal' }
  Remove-Item -LiteralPath $junctionPath -Force
  $removed += 'frontend/node_modules junction only'
}
$taskDirs = @('frontend/dist','.task-tmp/editor-release','docs/reports/evidence/editor-layout-20261112/__pycache__')
foreach ($relative in $taskDirs) {
  $target = Join-Path $resolvedTask $relative
  if (Test-Path -LiteralPath $target) {
    $absolute = (Resolve-Path -LiteralPath $target).Path
    if (-not $absolute.StartsWith($resolvedTask + [IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Target escaped task root' }
    if ((Get-Item -LiteralPath $absolute -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Refusing recursive link removal' }
    Remove-Item -LiteralPath $absolute -Recurse -Force
    $removed += $relative
  }
}
$taskFiles = @('change-layout.py','change-rating.py','refine-layout.py','measure-editor.py','prepare-editor-release.py','finalize-local-evidence.py','record-editor-delivery.py','frontend/editor-check.mjs','frontend/rating-check.mjs','frontend/rating-preview.html','frontend/rating-preview.tsx','frontend/verify-editor-final.mjs','frontend/verify-rating-built.mjs','frontend/verify-editor-public.mjs','frontend/capture-editor-published.mjs')
foreach ($relative in $taskFiles) {
  $target = Join-Path $resolvedTask $relative
  if (Test-Path -LiteralPath $target -PathType Leaf) { Remove-Item -LiteralPath $target -Force; $removed += $relative }
}
$keepLocal = @('local-en-US-360-expanded.png','local-en-US-390-expanded.png','local-en-US-360-expanded.json','local-en-US-390-expanded.json')
Get-ChildItem -LiteralPath $evidenceRoot -File | Where-Object { ($_.Name -like 'local-*' -and $_.Name -notin $keepLocal) -or $_.Name -in @('1440.png','390.png','360.png','1440-header.png','390-header.png','360-header.png','1440-viewport.png','390-viewport.png','360-viewport.png','debug.png','browser.json') } | ForEach-Object { Remove-Item -LiteralPath $_.FullName -Force; $removed += $_.Name }
@{result='PASS';taskRoot=$resolvedTask;removed=$removed;stoppedPreviewProcesses=$stopped;borrowedDependenciesPreserved=$true;formalEvidencePreserved=$true} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $evidenceRoot 'cleanup-result.json') -Encoding utf8
Write-Output 'PASS task-local cleanup; evidence and borrowed dependencies retained'
