$ErrorActionPreference = "Stop"
$ImagePath = "c:\workspace\bobbuy\sample\IMG_1484.jpg"
Write-Host "Reading image: $ImagePath"
$Bytes = [System.IO.File]::ReadAllBytes($ImagePath)
$Base64String = [System.Convert]::ToBase64String($Bytes)
$Base64Data = "data:image/jpeg;base64," + $Base64String

$Body = @{
    base64Image = $Base64Data
} | ConvertTo-Json -Depth 5

Write-Host "Sending POST request to AI Service (via Gateway)..."
$Response = Invoke-RestMethod -Uri "http://localhost/api/ai/onboard/scan" -Method Post -ContentType "application/json" -Body $Body -TimeoutSec 120

Write-Host "Response Received:"
$Response | ConvertTo-Json -Depth 10 | Out-File "c:\workspace\bobbuy\ai-response.json"
Write-Host "Response saved to c:\workspace\bobbuy\ai-response.json"
