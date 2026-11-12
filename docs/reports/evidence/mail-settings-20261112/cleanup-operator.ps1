$ErrorActionPreference = 'Stop'
$expectedRoot = 'C:\Users\X02851\OneDrive - One人事株式会社\文档\ChatGPT\bobuy.cc\.task-tmp\mail-settings-20261112'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
if ($taskRoot -ne $expectedRoot) { throw 'Unexpected task root' }
$removed = [Collections.Generic.List[string]]::new()
$link = Join-Path $taskRoot 'frontend/node_modules'
if (Test-Path -LiteralPath $link) {
    $item = Get-Item -LiteralPath $link -Force
    if ($item.LinkType -ne 'Junction') { throw 'Dependency path is not the task junction' }
    Remove-Item -LiteralPath $link -Force
    $removed.Add('frontend/node_modules junction only')
}
foreach ($relative in @('.task-tmp', 'frontend/dist')) {
    $target = Join-Path $taskRoot $relative
    if (Test-Path -LiteralPath $target) {
        $resolved = (Resolve-Path -LiteralPath $target).ProviderPath
        if (-not $resolved.StartsWith($taskRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Cleanup escaped task root' }
        if ((Get-Item -LiteralPath $resolved -Force).LinkType) { throw 'Unexpected cleanup link' }
        Remove-Item -LiteralPath $resolved -Recurse -Force
        $removed.Add($relative)
    }
}
$result = @{result='PASS';root=$taskRoot;removed=$removed;formalEvidenceRetained=$true;protectedRecoveryRetained=$true}
$result | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'cleanup-result.json') -Encoding utf8
$result | ConvertTo-Json -Depth 4
