param([string]$Model, [string]$PromptPath, [string]$OutputPath, [string[]]$ImagePath=@())
$ErrorActionPreference = 'Stop'
try {
    if ($Model -eq 'deepseek-flash') {
        $runner = Join-Path $env:USERPROFILE '.codex/skills/deepseek-api-agent/scripts/invoke-deepseek.ps1'
        $reply = & $runner -Model $Model -ReasoningEffort high -Prompt (Get-Content -Raw -LiteralPath $PromptPath)
    }
    else {
        $runner = Join-Path $env:USERPROFILE '.codex/skills/sub2api-agent/scripts/invoke-sub2api.ps1'
        $reply = & $runner -Model $Model -Prompt (Get-Content -Raw -LiteralPath $PromptPath) -ImagePath $ImagePath
    }
    [IO.File]::WriteAllText($OutputPath, ($reply -join "`n"), [Text.UTF8Encoding]::new($false))
    Write-Output 'ADVISORY_TEXT_SAVED'
}
catch {
    $category = 'request_failed'
    $message = $_.ToString()
    if ($message -match 'no available accounts|no available channel|no_available') { $category = 'upstream_unavailable' }
    elseif ($message -match '503|502|504') { $category = 'upstream_http_error' }
    elseif ($message -match 'bridge|endpoint check') { $category = 'loopback_unavailable' }
    elseif ($message -match 'unavailable.*Available models') { $category = 'model_not_visible' }
    elseif ($message -match '401|403') { $category = 'authorization_error' }
    $receipt = @{ result = 'FAILED'; model = $Model; category = $category } | ConvertTo-Json
    [IO.File]::WriteAllText($OutputPath, $receipt, [Text.UTF8Encoding]::new($false))
    Write-Output "ADVISORY_FAILED category=$category"
    exit 1
}
