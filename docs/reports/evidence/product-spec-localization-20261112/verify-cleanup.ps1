$ErrorActionPreference='Stop'
$evidence='docs/reports/evidence/product-spec-localization-20261112'
$receiptPath=Join-Path $evidence 'cleanup.json'
$receipt=Get-Content -LiteralPath $receiptPath -Raw -Encoding utf8 | ConvertFrom-Json
$targets=@('.task-tmp/spec-test-temp','.task-tmp/spec-release','frontend/dist','frontend/node_modules','docs/reports/evidence/product-introductions-20261112/__pycache__','docs/reports/evidence/product-spec-localization-20261112/__pycache__','evidence-bridge.mjs','spec-inventory.mjs')
foreach($target in $targets){if(Test-Path -LiteralPath $target){throw "Task temporary target remains: $target"}}
foreach($port in @(18747,4190)){
 $socket=[Net.Sockets.TcpClient]::new()
 try{$connect=$socket.ConnectAsync('127.0.0.1',$port);if($connect.Wait(1200) -and $socket.Connected){throw "Task port remains open: $port"}}catch [AggregateException]{}finally{$socket.Dispose()}
}
$receipt | Add-Member -NotePropertyName verifiedAbsentTargets -NotePropertyValue $targets -Force
$receipt | Add-Member -NotePropertyName taskPortsClosed -NotePropertyValue @(18747,4190) -Force
$receipt | Add-Member -NotePropertyName executedCleanupScriptSha256 -NotePropertyValue '210cbaa0d5772e8022bc339baca44e3fb8e87ba255cb93300773beb71f974ed0' -Force
$receipt | Add-Member -NotePropertyName reportingCorrection -NotePropertyValue 'Directory deletion completed; directory-list reporting scope corrected afterward and absence independently verified. No destructive rerun.' -Force
$receipt | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $receiptPath -Encoding utf8
Write-Output 'Independent cleanup verification PASS'
