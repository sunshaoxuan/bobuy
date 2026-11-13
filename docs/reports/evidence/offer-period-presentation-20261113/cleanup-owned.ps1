param([Parameter(Mandatory=$true)][string]$ManifestPath)
$ErrorActionPreference='Stop'
$plan=Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
$taskRoot=[IO.Path]::GetFullPath([string]$plan.Root).TrimEnd('\','/')
$prefix=$taskRoot+[IO.Path]::DirectorySeparatorChar
$rootItem=Get-Item -LiteralPath $taskRoot -Force
if($rootItem.LinkType -or $rootItem.LinkTarget){throw 'Task root is a link'}
$relative=@($plan.Files | ForEach-Object {[IO.Path]::GetRelativePath($taskRoot,[string]$_.Path)})
$tracked=@(& git -C $taskRoot ls-files -- $relative)
if($LASTEXITCODE -ne 0 -or $tracked.Count -gt 0){throw 'Tracked files or Git check failure'}
foreach($protected in $plan.Protected){
 if((Get-FileHash -LiteralPath $protected.Path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $protected.Sha256){throw 'Protected evidence changed'}
}
foreach($entry in $plan.Files){
 $full=[IO.Path]::GetFullPath([string]$entry.Path)
 if(-not $full.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetDirectoryName($full) -ne $taskRoot -or $full.IndexOfAny([char[]]'*?') -ge 0){throw 'Target is outside the exact flat task scope'}
 foreach($keep in $plan.ProtectedRoots){if($full.StartsWith(([IO.Path]::GetFullPath([string]$keep).TrimEnd('\','/')+[IO.Path]::DirectorySeparatorChar),[StringComparison]::OrdinalIgnoreCase)){throw 'Formal output is protected'}}
 $item=Get-Item -LiteralPath $full -Force
 if($item.PSIsContainer -or $item.LinkType -or $item.LinkTarget){throw 'Only regular task-owned files are allowed'}
 if($item.Length -ne $entry.Bytes -or [string]$item.LastWriteTimeUtc.Ticks -ne [string]$entry.UtcTicks){throw 'Target metadata changed'}
 if((Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.Sha256){throw 'Target content changed'}
}
$removed=@();$retained=@();$bytes=0L
foreach($entry in $plan.Files){
 $item=Get-Item -LiteralPath $entry.Path -Force
 if($item.Length -ne $entry.Bytes -or [string]$item.LastWriteTimeUtc.Ticks -ne [string]$entry.UtcTicks){throw 'Target changed before removal'}
 try{Remove-Item -LiteralPath $entry.Path -Force;$removed+=[string]$entry.Path;$bytes+=[long]$entry.Bytes}catch{$retained+=@{Path=[string]$entry.Path;Reason=$_.Exception.Message}}
}
foreach($protected in $plan.Protected){if((Get-FileHash -LiteralPath $protected.Path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $protected.Sha256){throw 'Protected evidence changed after cleanup'}}
foreach($name in $removed){if(Test-Path -LiteralPath $name){throw 'Removal did not complete'}}
@{Removed=$removed;LogicalBytes=$bytes;Retained=$retained;ProtectedHashesMatched=$plan.Protected.Count;PreservedDependenciesAndPriorDeniedDirectories=$true} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $plan.ReceiptPath -Encoding utf8
Write-Output ('Removed {0} task files; preserved {1} protected files; retained {2} files.' -f $removed.Count,$plan.Protected.Count,$retained.Count)
