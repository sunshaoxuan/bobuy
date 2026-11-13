$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

if (-not (Get-Command sops -ErrorAction SilentlyContinue)) { throw 'sops is required' }
$match = Select-String -Path '.sops.yaml' -Pattern '^\s*age:\s*(\S+)' | Select-Object -First 1
$recipient = if ($match) { $match.Matches[0].Groups[1].Value } else { '' }
if (-not $recipient -or $recipient -eq 'age1REPLACE_ME') {
    throw 'Replace age1REPLACE_ME in .sops.yaml with the maintainer age public key.'
}

$files = @(
    '.env',
    'backend/src/main/resources/application-dev.properties',
    'backend/src/main/resources/application-ai-hermes.properties'
)

foreach ($source in $files) {
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing plaintext file: $source" }
    $target = "$source.enc"
    $temporary = "$target.tmp"
    try {
        & sops encrypt --input-type binary --output-type binary --age $recipient --output $temporary $source
        if ($LASTEXITCODE -ne 0) { throw "sops failed to encrypt $source" }
        Move-Item -LiteralPath $temporary -Destination $target -Force
        Write-Host "Encrypted $source -> $target"
    } finally {
        Remove-Item -LiteralPath $temporary -Force -ErrorAction SilentlyContinue
    }
}
