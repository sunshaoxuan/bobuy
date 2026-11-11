# Exact scoped cleanup retained with the release evidence; does not remove deliverables.
$ErrorActionPreference = 'Stop'
$detailTaskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
if (-not $detailTaskRoot.EndsWith('\.task-tmp\detail-layout-20261112')) { throw 'Unexpected task root' }
$preview = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -like '*detail-layout-20261112*' -and $_.CommandLine -like '*vite*' }
$preview | ForEach-Object { Stop-Process -Id $_.ProcessId }
$link = Join-Path $detailTaskRoot 'frontend/node_modules'
if (Test-Path -LiteralPath $link) {
    if (-not ((Get-Item -LiteralPath $link -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Expected dependency junction' }
    Remove-Item -LiteralPath $link -Force
}
$directories = @('.task-tmp/detail-release','.task-tmp/detail-language-release','frontend/dist','scripts/__pycache__','docs/reports/evidence/detail-layout-20261112/__pycache__','docs/reports/evidence/detail-layout-20261112/compatibility/__pycache__')
foreach ($relative in $directories) {
    $target = [IO.Path]::GetFullPath((Join-Path $detailTaskRoot $relative))
    if (-not $target.StartsWith($detailTaskRoot + '\')) { throw 'Out-of-task directory' }
    if (Test-Path -LiteralPath $target) {
        if ((Get-Item -LiteralPath $target -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Unexpected directory link' }
        Remove-Item -LiteralPath $target -Recurse -Force
    }
}
$files = @('.task-tmp/detail-payload.tar','.task-tmp/detail-language-payload.tar','write-detail-styles.py','prepare-detail-release.py','prepare-language-release.py','production-read.py','detail-release.py','detail-language-release.py','detail-glyphs.py','detail-action-glyphs.py','finalize-detail.py','detail-build.log','detail-gemini-pro.txt','detail-gemini-flash.txt','detail-gemini-final.txt','frontend/detail-check.mjs','frontend/detail-control-check.mjs','frontend/detail-stress.mjs','frontend/detail-catalog-gallery.mjs','frontend/detail-tests.log','frontend/detail-tests-final.log','frontend/detail-tests-accepted.log','frontend/detail-tests-language.log','frontend/detail-build-final.log','frontend/detail-build-accepted.log','frontend/detail-build-frozen.log','frontend/detail-build-release.log','frontend/detail-build-language.log')
foreach ($relative in $files) {
    $target = [IO.Path]::GetFullPath((Join-Path $detailTaskRoot $relative))
    if (-not $target.StartsWith($detailTaskRoot + '\')) { throw 'Out-of-task file' }
    if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Force }
}
$receipt = @{ result = 'PASS'; scope = 'detail-layout-20261112'; directories = $directories; files = $files; previewProcessesStopped = @($preview).Count; formalEvidenceRetained = $true; atUtc = [DateTime]::UtcNow.ToString('o'); operatorSha256 = (Get-FileHash -LiteralPath (Join-Path $PSScriptRoot 'cleanup-operator.ps1') -Algorithm SHA256).Hash }
$receipt | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'cleanup-result.json') -Encoding utf8
Write-Output 'Scoped detail task temporary outputs removed; formal evidence retained.'
