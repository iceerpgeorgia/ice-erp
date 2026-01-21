Write-Host "[STEP 1] Stopping any existing Node processes..." -ForegroundColor Cyan
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
Write-Host "[STEP 1] Complete - All Node processes stopped" -ForegroundColor Green

Write-Host "`n[STEP 2] Starting dev server in background..." -ForegroundColor Cyan
$job = Start-Job -ScriptBlock {
    Set-Location C:\next-postgres-starter
    $env:SKIP_LOG_PROMPT = "true"
    node_modules\.bin\next dev 2>&1 | Tee-Object -FilePath C:\next-postgres-starter\Server_Logs_New.txt
}
Write-Host "[STEP 2] Dev server job started (ID: $($job.Id))" -ForegroundColor Green

Write-Host "`n[STEP 3] Waiting for server to start..." -ForegroundColor Cyan
for ($i = 1; $i -le 14; $i++) {
    Write-Host "  Waiting... $i/14 seconds" -ForegroundColor Gray
    Start-Sleep -Seconds 1
}
Write-Host "[STEP 3] Complete - Waited 14 seconds" -ForegroundColor Green

Write-Host "`n[STEP 4] Testing if server is responsive..." -ForegroundColor Cyan
try {
    $testResponse = Invoke-RestMethod -Uri "http://localhost:3000" -TimeoutSec 5 -ErrorAction SilentlyContinue
    Write-Host "[STEP 4] Server is UP and responding!" -ForegroundColor Green
} catch {
    Write-Host "[STEP 4] WARNING: Server may not be ready yet - $_" -ForegroundColor Yellow
}

Write-Host "`n[STEP 5] Calling API endpoint /api/bank-transactions?limit=2..." -ForegroundColor Cyan
try {
    $result = Invoke-RestMethod -Uri "http://localhost:3000/api/bank-transactions?limit=2" -TimeoutSec 10
    Write-Host "[STEP 5] API call SUCCESSFUL!" -ForegroundColor Green
    Write-Host "`nAPI Response:" -ForegroundColor White
    $result | ConvertTo-Json -Depth 3
    
    # Check for new columns
    if ($result.data -and $result.data.Count -gt 0) {
        $firstRecord = $result.data[0]
        Write-Host "`n[COLUMN CHECK]" -ForegroundColor Cyan
        Write-Host "  correction_date exists: $($null -ne $firstRecord.correction_date)" -ForegroundColor $(if ($null -ne $firstRecord.correction_date) { "Green" } else { "Red" })
        Write-Host "  exchange_rate exists: $($null -ne $firstRecord.exchange_rate)" -ForegroundColor $(if ($null -ne $firstRecord.exchange_rate) { "Green" } else { "Red" })
    }
} catch {
    Write-Host "[STEP 5] ERROR calling API: $_" -ForegroundColor Red
    Write-Host "`nChecking server logs for errors..." -ForegroundColor Yellow
    if (Test-Path C:\next-postgres-starter\Server_Logs_New.txt) {
        Get-Content C:\next-postgres-starter\Server_Logs_New.txt | Select-Object -Last 30
    }
}

Write-Host "`n[STEP 6] Cleaning up - stopping dev server..." -ForegroundColor Cyan
Stop-Job $job -ErrorAction SilentlyContinue
Remove-Job $job -ErrorAction SilentlyContinue
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Host "[STEP 6] Complete - All cleaned up" -ForegroundColor Green

Write-Host "`n=== TEST COMPLETE ===" -ForegroundColor White
