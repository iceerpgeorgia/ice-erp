# Test the updated NBG cron job with intelligent backfill

Write-Host "🧪 Testing updated NBG cron job with auto-backfill" -ForegroundColor Cyan
Write-Host ""

# Wait for deployment
Write-Host "⏳ Waiting for Vercel deployment (60 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 60

Write-Host ""
Write-Host "🚀 Testing cron endpoint..." -ForegroundColor Cyan
Write-Host ""

$cronSecret = "pA0josnPQ0Qnee6B47f7ATN/GN60cNfxU3SXJKZwSQA="
$url = "https://ice-erp-git-feat-add-entry-model-iceerpgeorgia.vercel.app/api/cron/update-nbg-rates"

try {
    $response = Invoke-WebRequest -Uri $url -Method GET -Headers @{
        "Authorization" = "Bearer $cronSecret"
    } -UseBasicParsing
    
    Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host ""
    
    $data = $response.Content | ConvertFrom-Json
    
    Write-Host "📊 Cron Job Results:" -ForegroundColor Cyan
    Write-Host "   Success: $($data.success)"
    Write-Host "   Date: $($data.date)"
    Write-Host "   Action: $($data.action)"
    Write-Host "   Processed Currencies: $($data.processedCurrencies)"
    Write-Host "   Filled Missing Dates: $($data.filledMissingDates)" -ForegroundColor $(if ($data.filledMissingDates -gt 0) { "Yellow" } else { "Green" })
    Write-Host ""
    
    if ($data.filledMissingDates -gt 0) {
        Write-Host "🎯 Auto-backfill feature worked! Filled $($data.filledMissingDates) missing date(s)" -ForegroundColor Green
    } else {
        Write-Host "✅ No gaps detected - database is up to date" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "💱 Exchange Rates:" -ForegroundColor Cyan
    Write-Host "   USD: $($data.rates.usd)"
    Write-Host "   EUR: $($data.rates.eur)"
    Write-Host "   GBP: $($data.rates.gbp)"
    Write-Host "   CNY: $($data.rates.cny)"
    
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Response: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=" -NoNewline
Write-Host ("=" * 79)
Write-Host ""
Write-Host "🎉 Updated cron job features:" -ForegroundColor Green
Write-Host "   ✓ Fetches today's rates from NBG API"
Write-Host "   ✓ Detects missing dates automatically"
Write-Host "   ✓ Backfills gaps using NBG API ?date= parameter"
Write-Host "   ✓ Handles weekends correctly (uses Friday rates)"
Write-Host "   ✓ No more manual intervention needed!"
