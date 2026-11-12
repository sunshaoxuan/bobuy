param([Parameter(Mandatory=$true)][string]$TaskRoot)
$ErrorActionPreference='Stop'
$taskBase=(Resolve-Path -LiteralPath $TaskRoot).ProviderPath
if (-not $taskBase.EndsWith('\.task-tmp\unified-product-cards-20261111',[StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected task checkout' }
$evidence=Join-Path $taskBase 'docs/reports/evidence/social-platform-select-20261112'
$targetNames=@('.task-tmp/social-platform-select-20261112','.task-tmp/account-balance-20261112','docs/reports/evidence/account-balance-20261112/__pycache__')
$targets=@($targetNames | ForEach-Object { [IO.Path]::GetFullPath((Join-Path $taskBase $_)) })
foreach ($target in $targets) {
    if (-not $target.StartsWith($taskBase+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Target escapes task checkout' }
    if (Test-Path -LiteralPath $target) {
        $items=@(Get-Item -LiteralPath $target -Force)+@(Get-ChildItem -LiteralPath $target -Force -Recurse)
        if (@($items | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count) { throw 'Target contains a link' }
    }
}
$allowed=@{
    '.task-tmp/social-platform-select-20261112'=@('flash-probe.txt','inventory.py','prepare-correction.py','prepare-release.py','probe.png')
    '.task-tmp/account-balance-20261112'=@('Dockerfile','payload.tar.gz')
    'docs/reports/evidence/account-balance-20261112/__pycache__'=@('stage-release.cpython-313.pyc')
}
$temporaryFiles=@()
foreach ($name in $targetNames) {
    $target=Join-Path $taskBase $name
    if (Test-Path -LiteralPath $target) {
        foreach ($file in Get-ChildItem -LiteralPath $target -Force -Recurse) {
            if ($file.PSIsContainer -or $file.Name -notin $allowed[$name]) { throw 'Unexpected temporary entry' }
            $temporaryFiles+=@{path=[IO.Path]::GetRelativePath($taskBase,$file.FullName);sha256=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash;bytes=$file.Length}
        }
    }
}
$binding=Get-Content -LiteralPath (Join-Path $evidence 'local-payload-binding.json') -Raw | ConvertFrom-Json
if ($binding.source -ne 'ec24fa9af47b38999b98fc848e8ccf77787ddad2' -or $binding.result -ne 'PASS') { throw 'Package ownership is unverified' }
foreach ($pair in @(@('payload.tar.gz',$binding.payloadSha256),@('Dockerfile',$binding.dockerfileSha256))) {
    $package=Join-Path $targets[1] $pair[0]
    if ((Get-FileHash -LiteralPath $package -Algorithm SHA256).Hash -ne $pair[1]) { throw 'Package changed after verification' }
}
function Get-EvidenceSnapshot {
    $roots=@($evidence,(Join-Path $taskBase 'docs/reports/evidence/account-balance-20261112'),(Join-Path $taskBase 'docs/reports/evidence/account-profile-404-20261111/__pycache__'))
    $rows=@()
    foreach ($root in $roots) {
        if (Test-Path -LiteralPath $root) {
            foreach ($file in Get-ChildItem -LiteralPath $root -File -Recurse -Force) {
                if ($file.FullName.StartsWith($targets[2]+'\',[StringComparison]::OrdinalIgnoreCase)) { continue }
                if ($file.DirectoryName -eq $evidence -and $file.Name -in @('local-cleanup.json','local-preserved-files.json')) { continue }
                $rows+=@{path=[IO.Path]::GetRelativePath($taskBase,$file.FullName);sha256=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash}
            }
        }
    }
    return @($rows | Sort-Object { $_.path })
}
$preserved=Get-EvidenceSnapshot
$preserved | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $evidence 'local-preserved-files.json') -Encoding utf8
$nodeBefore=@(Get-CimInstance Win32_Process -Filter "Name = 'node.exe' OR Name = '.gate-node20.exe'")
$preview=@($nodeBefore | Where-Object { $_.ProcessId -eq 61516 })
if ($preview.Count -ne 1) { throw 'Expected preview PID is absent; reconcile before continuing' }
$preview=$preview[0]
if ($preview.Name -ne '.gate-node20.exe' -or $preview.CreationDate.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss') -ne '2026-11-12T02:09:35') { throw 'Preview PID identity changed' }
if (-not ($preview.CommandLine.Contains('node_modules/vite/bin/vite.js preview') -and $preview.CommandLine.Contains('--host 127.0.0.1 --port 5191 --strictPort') -and $preview.CommandLine.Contains('\.task-tmp\release-test-gate-20261111\.gate-node20.exe'))) { throw 'Preview command identity changed' }
$receipt=[ordered]@{result='RUNNING';authorization='User explicitly requested scoped local cleanup while preserving screenshots and acceptance records';previewPid=61516;previewPort=5191;temporaryFiles=$temporaryFiles;preservedFiles=$preserved.Count;removed=@();otherNodeProcessesBefore=@($nodeBefore | Where-Object {$_.ProcessId -ne 61516}).Count}
try {
    Stop-Process -Id 61516
    if (Get-Process -Id 61516 -ErrorAction SilentlyContinue) { Wait-Process -Id 61516 -Timeout 10 }
    $receipt.previewStopped=$null -eq (Get-Process -Id 61516 -ErrorAction SilentlyContinue)
    $receipt.previewPortReleased=@([Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | Where-Object { $_.Port -eq 5191 }).Count -eq 0
    if (-not $receipt.previewStopped -or -not $receipt.previewPortReleased) { throw 'Preview process or listener remains' }
    foreach ($target in $targets) {
        if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force; $receipt.removed+=([IO.Path]::GetRelativePath($taskBase,$target)) }
        if (Test-Path -LiteralPath $target) { throw 'Temporary target remains' }
    }
    $after=Get-EvidenceSnapshot
    if (($preserved | ConvertTo-Json -Depth 5 -Compress) -cne ($after | ConvertTo-Json -Depth 5 -Compress)) { throw 'Preserved evidence inventory or SHA changed' }
    $receipt.evidenceSha256Unchanged=$true
    $nodeAfter=@(Get-CimInstance Win32_Process -Filter "Name = 'node.exe' OR Name = '.gate-node20.exe'")
    $receipt.otherNodeProcessesStillRunning=@($nodeBefore | Where-Object { $original=$_; $original.ProcessId -ne 61516 -and @($nodeAfter | Where-Object {$_.ProcessId -eq $original.ProcessId -and $_.CreationDate -eq $original.CreationDate}).Count -eq 1 }).Count
    $receipt.processesStoppedByThisScript=@(61516)
    $receipt.productionAccessed=$false
    $receipt.result='PASS'
} catch { $receipt.result='FAIL'; $receipt.error=$_.Exception.Message; throw }
finally {
    $receipt.atUtc=[DateTime]::UtcNow.ToString('o')
    $receipt | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath (Join-Path $evidence 'local-cleanup.json') -Encoding utf8
}
$receipt | ConvertTo-Json -Depth 7 -Compress
