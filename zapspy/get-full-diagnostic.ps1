# Get complete diagnostic data from admin panel
$baseUrl = "https://painel.xaimonitor.com"

# Login payload
$loginJson = '{"email":"admin@whatspy","password":"whatspy2024"}'
$loginJson | Out-File -FilePath "temp-login.json" -Encoding ASCII -NoNewline

# Login to get token
Write-Host "Logging in..." -ForegroundColor Yellow
$loginResult = & C:\Windows\System32\curl.exe -X POST "$baseUrl/api/admin/login" -H "Content-Type: application/json" --data-binary "@temp-login.json" -k -s
$loginData = $loginResult | ConvertFrom-Json

if ($loginData.token) {
    Write-Host "Login successful!" -ForegroundColor Green
    $token = $loginData.token
    
    # Get diagnostic data
    Write-Host "Fetching diagnostic data..." -ForegroundColor Yellow
    $diagnosticResult = & C:\Windows\System32\curl.exe "$baseUrl/api/admin/refund-diagnostic" -H "Authorization: Bearer $token" -k -s
    
    # Save raw output
    $diagnosticResult | Out-File -FilePath "diagnostic-full-output.json" -Encoding UTF8
    
    Write-Host "`n=== COMPLETE DIAGNOSTIC DATA ===" -ForegroundColor Cyan
    Write-Host $diagnosticResult
    Write-Host "`n=== Saved to diagnostic-full-output.json ===" -ForegroundColor Green
} else {
    Write-Host "Login failed!" -ForegroundColor Red
    Write-Host $loginResult
}

# Cleanup
Remove-Item "temp-login.json" -ErrorAction SilentlyContinue
