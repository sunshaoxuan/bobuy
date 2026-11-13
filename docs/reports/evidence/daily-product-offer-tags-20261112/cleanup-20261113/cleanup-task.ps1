[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$PlanPath,
    [Parameter(Mandatory=$true)][string]$ExpectedPlanSha256,
    [switch]$Apply
)
$ErrorActionPreference='Stop'
$planFile=(Resolve-Path -LiteralPath $PlanPath).ProviderPath
if((Get-FileHash -LiteralPath $planFile -Algorithm SHA256).Hash -ne $ExpectedPlanSha256){throw 'Cleanup plan content changed.'}
$plan=Get-Content -Raw -LiteralPath $planFile | ConvertFrom-Json
$taskRoot=(Resolve-Path -LiteralPath $plan.root).ProviderPath.TrimEnd('\','/')
if((Split-Path -Leaf $taskRoot) -ne 'daily-product-offer-tags-20261112'){throw 'Wrong task root.'}
if(-not (Test-Path -LiteralPath (Join-Path $taskRoot '.git') -PathType Leaf)){throw 'Expected isolated Git worktree.'}
$prefix=$taskRoot+[IO.Path]::DirectorySeparatorChar
$allowed=@('.task-tmp','backend/target','bobbuy-common/target','bobbuy-core/target','bobbuy-ai/target','bobbuy-im/target','bobbuy-auth/target','bobbuy-gateway/target','frontend/dist','scripts/__pycache__','docs/reports/evidence/daily-product-offer-tags-20261112/__pycache__','docs/reports/evidence/daily-product-offer-tags-20261112/erp-price-documents/__pycache__','docs/reports/evidence/daily-product-offer-tags-20261112/inspect-server.py','docs/reports/evidence/daily-product-offer-tags-20261112/probe-models.py','docs/reports/evidence/daily-product-offer-tags-20261112/public-http-probe.txt') | ForEach-Object {[IO.Path]::GetFullPath((Join-Path $taskRoot $_))}
$verifiedDirectoryLinks=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
function Assert-TaskTarget([string]$Path){
    $full=[IO.Path]::GetFullPath($Path)
    if(-not $full.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)){throw 'Cleanup target escapes task root.'}
    $matched=$false
    foreach($scope in $allowed){
        if($full.Equals($scope,[StringComparison]::OrdinalIgnoreCase) -or $full.StartsWith($scope+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){$matched=$true;break}
    }
    if(-not $matched){throw 'Target is outside the frozen temporary paths.'}
    $parent=$full
    while($parent -and -not $parent.Equals($taskRoot,[StringComparison]::OrdinalIgnoreCase)){
        if($verifiedDirectoryLinks.Contains($parent)){break}
        $item=Get-Item -LiteralPath $parent -Force
        if($item.LinkType -or $item.Target){throw 'Refusing symbolic link or junction.'}
        if($item.PSIsContainer){[void]$verifiedDirectoryLinks.Add($parent)}
        $parent=Split-Path -Parent $parent
    }
    return $full
}
$tracked=[Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$trackedRaw=(& git -C $taskRoot ls-files -z) -join "`n"
if($LASTEXITCODE -ne 0){throw 'Could not inspect tracked deliverables.'}
foreach($name in $trackedRaw.Split([char]0,[StringSplitOptions]::RemoveEmptyEntries)){[void]$tracked.Add($name)}
$stat=@{}
foreach($entry in $plan.files){
    $full=Assert-TaskTarget $entry.path
    $relative=$full.Substring($prefix.Length).Replace('\','/')
    if($tracked.Contains($relative)){throw 'Refusing tracked file deletion.'}
    $item=Get-Item -LiteralPath $full -Force
    if($item.PSIsContainer -or $item.Length -ne $entry.bytes){throw 'Cleanup file changed type or size.'}
    if((Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash -ne $entry.sha256){throw 'Cleanup file content changed.'}
    $stat[$full]=@($item.Length,$item.LastWriteTimeUtc.Ticks)
}
foreach($dir in $plan.directories){[void](Assert-TaskTarget $dir)}
foreach($entry in $plan.preserve){
    if((Get-FileHash -LiteralPath $entry.path -Algorithm SHA256).Hash -ne $entry.sha256){throw 'Protected deliverable changed before cleanup.'}
}
$summary=[ordered]@{phase='VALIDATED';root=$taskRoot;files=$plan.files.Count;directories=$plan.directories.Count;bytes=($plan.files|Measure-Object -Property bytes -Sum).Sum;protectedFiles=$plan.preserve.Count;planSha256=$ExpectedPlanSha256;applyRequested=[bool]$Apply}
$summary|ConvertTo-Json -Compress
if(-not $Apply){return}
$verifiedDirectoryLinks.Clear()
$removed=0
foreach($entry in $plan.files){
    $full=Assert-TaskTarget $entry.path
    $item=Get-Item -LiteralPath $full -Force
    if($item.Length -ne $stat[$full][0] -or $item.LastWriteTimeUtc.Ticks -ne $stat[$full][1]){throw 'Concurrent temporary-file change.'}
    Remove-Item -LiteralPath $full -Force
    $removed++
}
foreach($dir in $plan.directories){
    [void](Assert-TaskTarget $dir)
    if(@(Get-ChildItem -LiteralPath $dir -Force).Count -ne 0){throw 'Unlisted contents appeared; refusing recursive deletion.'}
    Remove-Item -LiteralPath $dir -Force
}
foreach($entry in $plan.files){if(Test-Path -LiteralPath $entry.path){throw 'Temporary file remains.'}}
foreach($dir in $plan.directories){if(Test-Path -LiteralPath $dir){throw 'Temporary directory remains.'}}
foreach($entry in $plan.preserve){if((Get-FileHash -LiteralPath $entry.path -Algorithm SHA256).Hash -ne $entry.sha256){throw 'Protected deliverable changed during cleanup.'}}
$summary.phase='CLEANED'
$summary.removedFiles=$removed
$summary.evidenceUnchanged=$true
$summary.completedAt=[DateTime]::UtcNow.ToString('o')
$receipt=Join-Path (Split-Path -Parent $planFile) 'cleanup-receipt.json'
$summary|ConvertTo-Json -Depth 5|Set-Content -LiteralPath $receipt -Encoding utf8
$summary|ConvertTo-Json -Compress
