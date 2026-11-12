$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
if ((Split-Path $taskRoot -Leaf) -ne 'resource-error-20261112') { throw 'Unexpected task root' }
$taskTargets = @('inspect-server.py','prepare-evidence.py','reconcile-runtime.py','release-client.py','runtime-probe.py','runtime-probe.json','runtime-after.json','bobbuy-gateway/target','docs/reports/evidence/resource-error-20261112/desktop-requests.json')
$removed = @()
foreach ($relative in $taskTargets) {
    $targetPath = [IO.Path]::GetFullPath((Join-Path $taskRoot $relative))
    if (-not $targetPath.StartsWith($taskRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Target escaped task root' }
    if (Test-Path -LiteralPath $targetPath) {
        $resolvedPath = (Resolve-Path -LiteralPath $targetPath).Path
        if (-not $resolvedPath.StartsWith($taskRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Resolved target escaped task root' }
        Remove-Item -LiteralPath $resolvedPath -Recurse -Force
        $removed += $relative
    }
}
@{ result='PASS'; removed=$removed; scope='exact task artifacts only' } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'cleanup.json') -Encoding UTF8
