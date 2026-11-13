$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

if (-not (Get-Command sops -ErrorAction SilentlyContinue)) { throw 'sops is required' }
$files = @(
    '.env',
    'backend/src/main/resources/application-dev.properties',
    'backend/src/main/resources/application-ai-hermes.properties'
)

foreach ($target in $files) {
    $source = "$target.enc"
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing encrypted file: $source" }
    $temporary = "$target.tmp"
    try {
        & sops decrypt --input-type binary --output-type binary --output $temporary $source
        if ($LASTEXITCODE -ne 0) { throw "sops failed to decrypt $source" }
        Move-Item -LiteralPath $temporary -Destination $target -Force
        Write-Host "Decrypted $source -> $target"
    } finally {
        Remove-Item -LiteralPath $temporary -Force -ErrorAction SilentlyContinue
    }
}
