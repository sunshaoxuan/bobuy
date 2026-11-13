param([Parameter(Mandatory=$true)][string]$TaskEvidenceRoot)
$ErrorActionPreference='Stop'
$target=[IO.Path]::GetFullPath((Join-Path $TaskEvidenceRoot 'payload.tar.gz'))
$retained=Get-Content -LiteralPath (Join-Path $TaskEvidenceRoot 'retained-payload.json') -Raw | ConvertFrom-Json
if($target -ne [IO.Path]::GetFullPath([string]$retained.localDuplicate) -or $retained.remote -ne '/opt/bobuy/releases/20261113.unified-brand.1/payload.tar.gz' -or -not $retained.safeToRemoveLocalDuplicate){throw 'No matching verified remote recovery copy'}
$item=Get-Item -LiteralPath $target -Force
if($item.PSIsContainer -or $item.LinkType -or $item.LinkTarget){throw 'Expected one regular task payload'}
if((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $retained.sha256){throw 'Local payload changed'}
$bytes=$item.Length
Remove-Item -LiteralPath $target -Force
if(Test-Path -LiteralPath $target){throw 'Payload removal failed'}
@{Removed=$target;LogicalBytes=$bytes;RetainedRemote=$retained.remote;Sha256=$retained.sha256;OtherPathsModified=$false} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $TaskEvidenceRoot 'cleanup-receipt.json') -Encoding utf8
Write-Output 'Removed one duplicate payload; verified production recovery copy retained.'
