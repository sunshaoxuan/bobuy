$ErrorActionPreference='Stop'
$coverageRoot='C:\Users\X02851\.codex\visualizations\2026\11\12\01a1cf14-a3b6-7071-a101-f5f28498198e'
$paths=@((Join-Path $coverageRoot 'price-documents-focused.exec'),(Join-Path $coverageRoot 'price-documents-read-focused.exec'))
$records=@()
foreach($path in $paths){
    $resolved=(Resolve-Path -LiteralPath $path).ProviderPath
    if((Split-Path -Parent $resolved) -ne $coverageRoot){throw 'Coverage path escaped this chat workspace.'}
    $item=Get-Item -LiteralPath $resolved -Force
    if($item.PSIsContainer -or $item.LinkType -or $item.Target){throw 'Expected regular development coverage file.'}
    $records+=@{path=$resolved;bytes=$item.Length;sha256=(Get-FileHash -LiteralPath $resolved -Algorithm SHA256).Hash}
}
foreach($path in $paths){Remove-Item -LiteralPath $path -Force}
foreach($path in $paths){if(Test-Path -LiteralPath $path){throw 'Coverage cache remains.'}}
$receipt=[ordered]@{result='CLEANED';files=$records;scope='Only the two development coverage caches in this chat workspace; formal verification archive and receipts retained';completedAt=[DateTime]::UtcNow.ToString('o')}
$receipt|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $PSScriptRoot 'coverage-cleanup-receipt.json') -Encoding utf8
$receipt|ConvertTo-Json -Compress -Depth 5
