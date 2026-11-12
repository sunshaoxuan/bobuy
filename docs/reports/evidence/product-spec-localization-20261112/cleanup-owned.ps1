param([Parameter(Mandatory=$true)][string]$TaskRoot,[Parameter(Mandatory=$true)][string]$SharedDependencies)
$ErrorActionPreference='Stop'
$taskPath=(Resolve-Path -LiteralPath $TaskRoot).ProviderPath
if($taskPath -ne (Get-Location).ProviderPath){throw 'Cleanup must run in the exact task worktree'}
$evidencePath=Join-Path $taskPath 'docs/reports/evidence/product-spec-localization-20261112'
$acceptance=Get-Content -LiteralPath (Join-Path $evidencePath 'acceptance.json') -Raw -Encoding utf8 | ConvertFrom-Json
if($acceptance.result -ne 'PASS'){throw 'Acceptance is incomplete'}
$gitSource=git rev-parse HEAD
if($LASTEXITCODE -ne 0 -or $gitSource -ne $acceptance.source){throw 'Frozen application source mismatch'}
$stopped=@();$removed=@()
foreach($port in @(18747,4190)){
 $connections=@(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
 foreach($ownedProcessId in @($connections.OwningProcess | Sort-Object -Unique)){
  if(!$ownedProcessId){continue}
  $processInfo=Get-CimInstance Win32_Process -Filter "ProcessId = $ownedProcessId"
  $matchesTask=if($port -eq 18747){$processInfo.CommandLine -match 'evidence-bridge\.mjs'}else{$processInfo.CommandLine -match 'vite.*preview' -and $processInfo.CommandLine -match '--port\s+4190'}
  if(!$matchesTask){throw "Unexpected process on task port $port; nothing stopped"}
  Stop-Process -Id $ownedProcessId -Force
  $stopped+=@{port=$port;processId=$ownedProcessId}
 }
}
function Remove-TaskDirectory([string]$relativePath){
 $candidate=Join-Path $taskPath $relativePath
 if(Test-Path -LiteralPath $candidate){
  $resolved=(Resolve-Path -LiteralPath $candidate).ProviderPath
  if(!$resolved.StartsWith($taskPath+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Directory outside task worktree'}
  $item=Get-Item -LiteralPath $resolved -Force
  if($item.LinkType -in @('Junction','SymbolicLink')){throw 'Unexpected directory link'}
  Remove-Item -LiteralPath $resolved -Recurse -Force
  $relativePath
 }
}
foreach($relativePath in @('.task-tmp/spec-test-temp','.task-tmp/spec-release','frontend/dist','docs/reports/evidence/product-introductions-20261112/__pycache__','docs/reports/evidence/product-spec-localization-20261112/__pycache__')){$removed+=@(Remove-TaskDirectory $relativePath)}
$dependencyLink=Join-Path $taskPath 'frontend/node_modules'
if(Test-Path -LiteralPath $dependencyLink){
 $link=Get-Item -LiteralPath $dependencyLink -Force
 $sharedPath=(Resolve-Path -LiteralPath $SharedDependencies).ProviderPath
 $actualTarget=[IO.Path]::GetFullPath(@($link.Target)[0])
 if($link.LinkType -ne 'Junction' -or $actualTarget -ne $sharedPath){throw 'Dependency junction target mismatch'}
 [IO.Directory]::Delete($dependencyLink)
 if(!(Test-Path -LiteralPath $SharedDependencies)){throw 'Shared dependency target must remain'}
 $removed+='frontend/node_modules junction only'
}
$temporaryFiles=@('evidence-bridge.mjs','spec-inventory.mjs','.task-tmp/spec-pr.md')
$temporaryEvidence=@('apply-presentation.py','review-translations.py','apply-final-copy.py','translation-draft-1.txt','translation-draft-2.txt','extra-translation-draft.txt','translation-input-1.json','translation-input-2.json','claude-probe.txt','gemini-pro-probe.txt','candidate-matrix.json','candidate-network.json','candidate-long-unit-en-mobile.png')
foreach($name in $temporaryEvidence){$temporaryFiles+=('docs/reports/evidence/product-spec-localization-20261112/'+$name)}
foreach($file in @(Get-ChildItem -LiteralPath $evidencePath -Filter 'candidate-*-whole.jpg' -File)){$temporaryFiles+=$file.FullName.Substring($taskPath.Length+1)}
foreach($relativePath in $temporaryFiles){
 $candidate=Join-Path $taskPath $relativePath
 if(Test-Path -LiteralPath $candidate){
  $resolved=(Resolve-Path -LiteralPath $candidate).ProviderPath
  if(!$resolved.StartsWith($taskPath+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'File outside task worktree'}
  Remove-Item -LiteralPath $resolved -Force
  $removed+=$relativePath
 }
}
$remaining=@(foreach($port in @(18747,4190)){Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue})
if($remaining.Count){throw 'Task listener is still active'}
foreach($port in @(18747,4190)){
 $socket=[Net.Sockets.TcpClient]::new()
 try{$connect=$socket.ConnectAsync('127.0.0.1',$port);if($connect.Wait(1200) -and $socket.Connected){throw "Task port remains open: $port"}}catch [AggregateException]{}finally{$socket.Dispose()}
}
$receipt=@{result='PASS';at=[DateTime]::UtcNow.ToString('o');source=$gitSource;stopped=$stopped;removed=$removed;sharedDependenciesPreserved=(Test-Path -LiteralPath $SharedDependencies);preexistingPlan63Preserved=(Test-Path -LiteralPath (Join-Path $taskPath '.task-tmp/plan63'));formalEvidenceAndCompletedWorktreePreserved=$true;productionImagesRetained=$true;globalRulesAndInstalledSkillsChanged=$false}
$receipt | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $evidencePath 'cleanup.json') -Encoding utf8
Write-Output "Owned cleanup PASS; removed $($removed.Count) targets; stopped $($stopped.Count) processes"
