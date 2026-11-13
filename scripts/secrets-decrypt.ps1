$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

if (-not (Get-Command sops -ErrorAction SilentlyContinue)) { throw 'sops is required' }
$files = @(
    '.env',
    'backend/src/main/resources/application-dev.properties',
    'backend/src/main/resources/application-ai-hermes.properties'
)

$temporaries = @()
try {
    foreach ($target in $files) {
        $source = "$target.enc"
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing encrypted file: $source" }
        $temporary = "$target.tmp.$([guid]::NewGuid().ToString('N'))"
        $null = New-Item -ItemType File -Path $temporary
        $temporaries += $temporary
        $acl = Get-Acl -LiteralPath $temporary
        $acl.SetAccessRuleProtection($true, $false)
        $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
        $rule = [System.Security.AccessControl.FileSystemAccessRule]::new($identity, 'FullControl', 'Allow')
        $acl.SetAccessRule($rule)
        Set-Acl -LiteralPath $temporary -AclObject $acl
        & sops decrypt --input-type binary --output-type binary --output $temporary $source
        if ($LASTEXITCODE -ne 0) { throw "sops failed to decrypt $source" }
    }
    for ($i = 0; $i -lt $files.Count; $i++) {
        Move-Item -LiteralPath $temporaries[$i] -Destination $files[$i] -Force
        Write-Host "Decrypted $($files[$i]).enc -> $($files[$i])"
    }
} finally {
    foreach ($temporary in $temporaries) {
        Remove-Item -LiteralPath $temporary -Force -ErrorAction SilentlyContinue
    }
}
