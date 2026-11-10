$ErrorActionPreference = "Continue"

$SampleDir = "c:\workspace\bobbuy\sample"
$Images = Get-ChildItem -Path $SampleDir -Filter "IMG_*.jpg" | Sort-Object Name
$Results = @()

Write-Host "Found $($Images.Count) images to process." -ForegroundColor White

foreach ($Image in $Images) {
    Write-Host "`n--- Processing $($Image.Name) ---" -ForegroundColor White
    $Bytes = [System.IO.File]::ReadAllBytes($Image.FullName)
    $Base64String = [System.Convert]::ToBase64String($Bytes)
    $Base64Data = "data:image/jpeg;base64," + $Base64String

    $ScanObj = @{ base64Image = $Base64Data; sampleId = $Image.Name }
    $ScanBytes = [System.Text.Encoding]::UTF8.GetBytes(($ScanObj | ConvertTo-Json -Depth 5))

    Write-Host "  [1/2] Scanning via /api/ai/onboard/scan ..."
    $ScanResponse = $null
    try {
        $ScanResponse = Invoke-RestMethod -Uri "http://localhost/api/ai/onboard/scan" `
            -Method Post -ContentType "application/json; charset=utf-8" -Body $ScanBytes -TimeoutSec 180
    } catch {
        $errMsg = $_.Exception.Message
        try {
            $s = $_.Exception.Response.GetResponseStream()
            if ($s) { $errMsg = (New-Object System.IO.StreamReader($s)).ReadToEnd() }
        } catch {}
        Write-Host "  [ERROR] Scan failed: $errMsg" -ForegroundColor Red
        $Results += [pscustomobject]@{Image=$Image.Name; Product=""; Status="SCAN_FAIL"; Detail=$errMsg}
        continue
    }

    if ($ScanResponse.status -ne "success") {
        $detail = $ScanResponse | ConvertTo-Json -Depth 3
        Write-Host "  [SKIP] Scan non-success: $detail" -ForegroundColor Yellow
        $Results += [pscustomobject]@{Image=$Image.Name; Product=""; Status="SCAN_ERR"; Detail=$detail}
        continue
    }

    $ProductName = $ScanResponse.data.name
    Write-Host "  [1/2] Scan OK: product='$ProductName'" -ForegroundColor Cyan

    $d = $ScanResponse.data

    # Clean description - strip <think>...</think>
    $cleanDesc = if ($d.description) { 
        [System.Text.RegularExpressions.Regex]::Replace($d.description, '(?s)<think>.*?</think>', '').Trim()
    } else { "" }

    $ConfirmObj = [ordered]@{
        name                    = $d.name
        brand                   = if ($d.brand) { $d.brand } else { $null }
        description             = $cleanDesc
        price                   = $d.price
        categoryId              = if ($d.categoryId) { $d.categoryId } else { "" }
        itemNumber              = if ($d.itemNumber) { $d.itemNumber } else { $null }
        storageCondition        = $d.storageCondition
        orderMethod             = $d.orderMethod
        mediaGallery            = @($d.mediaGallery)
        attributes              = @{}
        existingProductFound    = [bool]$d.existingProductFound
        existingProductId       = $d.existingProductId
        similarProductCandidates= @($d.similarProductCandidates)
        visibilityStatus        = $d.visibilityStatus
        detectedPriceTiers      = @($d.detectedPriceTiers)
        originalPhotoBase64     = ""
        inputSampleId           = if ($d.inputSampleId) { $d.inputSampleId } else { "" }
        recognitionSummary      = if ($d.recognitionSummary) { $d.recognitionSummary } else { "" }
        sourceDomains           = @($d.sourceDomains)
        rejectedSourceDomains   = @($d.rejectedSourceDomains)
        sourcePolicyVersion     = if ($d.sourcePolicyVersion) { $d.sourcePolicyVersion } else { "" }
        trace                   = $d.trace
        matchScore              = if ($null -ne $d.matchScore) { $d.matchScore } else { 0.0 }
        semanticReasoning       = if ($d.semanticReasoning) { $d.semanticReasoning } else { "" }
        fieldDiffs              = @($d.fieldDiffs)
        verificationTarget      = $d.verificationTarget
    }

    $ConfirmJson = $ConfirmObj | ConvertTo-Json -Depth 10
    $ConfirmBytes = [System.Text.Encoding]::UTF8.GetBytes($ConfirmJson)

    Write-Host "  [2/2] Confirming via /api/ai/onboard/confirm ..."
    $ConfirmResponse = $null
    try {
        $ConfirmResponse = Invoke-RestMethod -Uri "http://localhost/api/ai/onboard/confirm" `
            -Method Post -ContentType "application/json; charset=utf-8" -Body $ConfirmBytes -TimeoutSec 30
    } catch {
        $errMsg = $_.Exception.Message
        try {
            $s = $_.Exception.Response.GetResponseStream()
            if ($s) { $errMsg = (New-Object System.IO.StreamReader($s)).ReadToEnd() }
        } catch {}
        Write-Host "  [ERROR] Confirm failed: $errMsg" -ForegroundColor Red
        $Results += [pscustomobject]@{Image=$Image.Name; Product=$ProductName; Status="CONFIRM_FAIL"; Detail=$errMsg}
        continue
    }

    if ($ConfirmResponse.status -eq "success") {
        $ProductId = $ConfirmResponse.data.product.id
        Write-Host "  [OK]  Saved! ID=$ProductId  name='$ProductName'" -ForegroundColor Green
        $Results += [pscustomobject]@{Image=$Image.Name; Product=$ProductName; Status="OK"; Detail=$ProductId}
    } else {
        $detail = $ConfirmResponse | ConvertTo-Json -Depth 3
        Write-Host "  [FAIL] Confirm: $detail" -ForegroundColor Red
        $Results += [pscustomobject]@{Image=$Image.Name; Product=$ProductName; Status="CONFIRM_ERR"; Detail=$detail}
    }
}

$successCount = ($Results | Where-Object { $_.Status -eq "OK" }).Count
$failCount    = ($Results | Where-Object { $_.Status -ne "OK" }).Count

Write-Host "`n=============================="
Write-Host "Done. Success: $successCount / $($Images.Count)  Fail: $failCount"
Write-Host "`nDetailed Results:"
$Results | Format-Table -AutoSize
