$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
if(-not $taskRoot.EndsWith('\.task-tmp\reference-display-20261112',[StringComparison]::OrdinalIgnoreCase)){throw 'Wrong task root'}
$removed=[Collections.Generic.List[string]]::new()
function Remove-TaskPath([string]$relative){
 $target=[IO.Path]::GetFullPath((Join-Path $taskRoot $relative))
 if(-not $target.StartsWith($taskRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Unscoped target'}
 if(Test-Path -LiteralPath $target){Remove-Item -LiteralPath $target -Recurse -Force;$removed.Add($target)}
}
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {$_.CommandLine -and $_.CommandLine.Contains('reference-display-20261112') -and $_.CommandLine.Contains('vite') -and $_.CommandLine.Contains('5184')} | ForEach-Object {Stop-Process -Id $_.ProcessId -Force}
$link=Join-Path $taskRoot 'frontend/node_modules'
if(Test-Path -LiteralPath $link){$entry=Get-Item -LiteralPath $link;if(-not ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Expected dependency junction'};[IO.Directory]::Delete($link,$false);$removed.Add($link)}
foreach($relative in @('.release-stage','.sort-stage','.runtime-temp','backend/target','bobbuy-common/target','bobbuy-core/target','frontend/dist','scripts/__pycache__','edit-batch.py','update-tests.py','make-operator.py','prepare-release.py','prepare-sort.py','collect-evidence.py','ChecksumProof.java','debug.png','reference-payload.tar','sort-payload.tar','gemini-final.txt','frontend/debug-browser.mjs','frontend/reference-browser.mjs','frontend/reference-stress.mjs','frontend/reference-sort.mjs')){Remove-TaskPath $relative}
Get-ChildItem -LiteralPath $taskRoot -File -Filter '*.log' | ForEach-Object {Remove-TaskPath $_.Name}
Get-ChildItem -LiteralPath $PSScriptRoot -File | Where-Object {$_.Name.StartsWith('candidate-catalog-') -or $_.Name.StartsWith('candidate-recommendation-')} | ForEach-Object {Remove-TaskPath ('docs/reports/evidence/reference-display-20261112/'+$_.Name)}
$coverageRoot=[IO.Path]::GetFullPath('C:/workspace/codex-work/bobuy-reference-display-20261112')
if($coverageRoot -ne 'C:\workspace\codex-work\bobuy-reference-display-20261112'){throw 'Wrong coverage target'}
if(Test-Path -LiteralPath $coverageRoot){Remove-Item -LiteralPath $coverageRoot -Recurse -Force;$removed.Add($coverageRoot)}
@{result='PASS';removed=$removed;preserved='Formal source, screenshots, receipts, other tasks and shared dependencies'} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'cleanup.json') -Encoding utf8
