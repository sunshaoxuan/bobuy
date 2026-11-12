$ErrorActionPreference='Stop'
$root=(Get-Location).Path
if((Split-Path -Leaf $root) -ne 'engagement-main-20261112'){throw 'Unexpected worktree'}
$out=Join-Path $root 'docs/reports/evidence/completed-development-release-20261112'
$binding=Get-Content -Raw -LiteralPath (Join-Path $out 'local-qa-binding.json')|ConvertFrom-Json
$ids=@(& docker ps -aq)
$protected=@(& docker inspect @ids)|ConvertFrom-Json
foreach($entry in $binding.protectedContainers.psobject.Properties){
 $current=@($protected|Where-Object {$_.Name -eq $entry.Name})
 if($current.Count -ne 1 -or $current[0].Id -ne $entry.Value){throw 'Protected local container changed; inspect before cleanup'}
}
$junction=Join-Path $root 'frontend/node_modules'
$item=Get-Item -LiteralPath $junction -Force
if($item.LinkType -ne 'Junction'){throw 'Dependency path is not the owned junction'}
$expected=Join-Path (Split-Path (Split-Path $root -Parent) -Parent) 'frontend/node_modules'
if([IO.Path]::GetFullPath($item.LinkTarget) -ne [IO.Path]::GetFullPath($expected)){throw 'Unexpected dependency target'}
[IO.Directory]::Delete($junction)
if(!(Test-Path -LiteralPath $expected -PathType Container)){throw 'Shared dependencies missing'}
$owned=@(Join-Path $root '.task-tmp/completed-release';Join-Path $root 'frontend/dist')
foreach($path in $owned){
 if(Test-Path -LiteralPath $path){
  $resolved=(Resolve-Path -LiteralPath $path).Path
  if(!($resolved.StartsWith($root+[IO.Path]::DirectorySeparatorChar)) -or $resolved -ne [IO.Path]::GetFullPath($path)){throw 'Resolved cleanup target escaped worktree'}
  Remove-Item -LiteralPath $resolved -Recurse -Force
 }
}
$cache=Join-Path $out '__pycache__'
if(Test-Path -LiteralPath $cache){
 $resolved=(Resolve-Path -LiteralPath $cache).Path
 if($resolved -ne [IO.Path]::GetFullPath($cache) -or !$resolved.StartsWith($out+[IO.Path]::DirectorySeparatorChar)){throw 'Cache escaped evidence directory'}
 Remove-Item -LiteralPath $resolved -Recurse -Force
}
$receipt=@{result='PASS';localQa='Owned container/database/credentials/JAR removed by guarded local-qa.py';temporaryPathsRemoved=$owned;dependencyJunctionRemovedOnly=$junction;sharedDependencyTargetPreserved=$expected;protectedContainerCount=@($binding.protectedContainers.psobject.Properties).Count;productionRollback='Prior frontend image retained; no production cleanup executed';servers='Only owned Vite sessions86970 and34921 stopped'}
$receipt|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $out 'cleanup-final.json')
Write-Output 'OWNED_TEMPORARY_FILES_REMOVED; SHARED_DEPENDENCIES_AND_LOCAL_CONTAINERS_PRESERVED'
