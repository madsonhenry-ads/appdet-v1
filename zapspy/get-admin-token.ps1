# PowerShell script to extract adminToken from Chrome's localStorage
# This reads the Chrome LocalStorage database for painel.aimonitor.com

Write-Host "Searching for adminToken in Chrome's localStorage..." -ForegroundColor Cyan

# Chrome LocalStorage path
$chromeLocalStorage = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Local Storage\leveldb"

if (-not (Test-Path $chromeLocalStorage)) {
    Write-Host "Chrome LocalStorage not found at: $chromeLocalStorage" -ForegroundColor Red
    Write-Host "`nAlternative method:" -ForegroundColor Yellow
    Write-Host "1. Open https://painel.aimonitor.com/admin in Chrome" -ForegroundColor White
    Write-Host "2. Press F12 to open Developer Tools" -ForegroundColor White
    Write-Host "3. Go to Console tab" -ForegroundColor White
    Write-Host "4. Type: localStorage.getItem('adminToken')" -ForegroundColor White
    Write-Host "5. Copy the token value (without quotes)" -ForegroundColor White
    exit 1
}

Write-Host "Found Chrome LocalStorage directory" -ForegroundColor Green

# Search for adminToken in the leveldb files
$found = $false
Get-ChildItem -Path $chromeLocalStorage -Filter "*.ldb" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
    if ($content -match 'painel\.aimonitor\.com.*adminToken') {
        # Try to extract the token (JWT format)
        if ($content -match '(eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+)') {
            Write-Host "`nFound adminToken:" -ForegroundColor Green
            Write-Host $matches[1] -ForegroundColor Yellow
            
            # Save to file
            $matches[1] | Out-File -FilePath "admin-token.txt" -NoNewline
            Write-Host "`nToken saved to: admin-token.txt" -ForegroundColor Green
            $found = $true
        }
    }
}

if (-not $found) {
    Write-Host "`nToken not found in localStorage files." -ForegroundColor Yellow
    Write-Host "`nManual extraction method:" -ForegroundColor Yellow
    Write-Host "1. Open https://painel.aimonitor.com/admin in Chrome" -ForegroundColor White
    Write-Host "2. Press F12 to open Developer Tools" -ForegroundColor White
    Write-Host "3. Go to Application tab" -ForegroundColor White
    Write-Host "4. Expand 'Local Storage' in the left sidebar" -ForegroundColor White
    Write-Host "5. Click on 'https://painel.aimonitor.com'" -ForegroundColor White
    Write-Host "6. Find 'adminToken' in the key-value list" -ForegroundColor White
    Write-Host "7. Copy the value" -ForegroundColor White
}
