# Check when the cron job last ran by looking at the cron endpoint
Write-Host "🔍 Checking NBG Cron Job Status..." -ForegroundColor Cyan
Write-Host "=" * 80

# Current time info
$currentUTC = [DateTime]::UtcNow
$currentLocal = Get-Date
Write-Host "`n⏰ Current Time:"
Write-Host "   UTC: $($currentUTC.ToString('yyyy-MM-dd HH:mm:ss'))"
Write-Host "   Local: $($currentLocal.ToString('yyyy-MM-dd HH:mm:ss'))"

# Cron schedule info
Write-Host "`n📅 Cron Schedule:"
Write-Host "   Schedule: 0 19 * * * (19:00 UTC)"
Write-Host "   Georgian time: 23:00 (UTC+4)"

# Check if cron should have run today
$lastCronTime = Get-Date -Year $currentUTC.Year -Month $currentUTC.Month -Day $currentUTC.Day -Hour 19 -Minute 0 -Second 0
Write-Host "`n   Today's scheduled run: $($lastCronTime.ToString('yyyy-MM-dd HH:mm:ss')) UTC"

if ($currentUTC -lt $lastCronTime) {
    Write-Host "   ⏳ Cron has NOT run yet today (scheduled in $([Math]::Round(($lastCronTime - $currentUTC).TotalHours, 1)) hours)" -ForegroundColor Yellow
} else {
    $hoursSince = [Math]::Round(($currentUTC - $lastCronTime).TotalHours, 1)
    Write-Host "   ✅ Cron should have run $hoursSince hours ago" -ForegroundColor Green
}

Write-Host "`n" + ("=" * 80)
Write-Host "`n💡 To check if cron actually ran, check Vercel deployment logs:"
Write-Host "   https://vercel.com/iceerpgeorgia/ice-erp/deployments"
Write-Host "`n   Or test the endpoint manually:"
Write-Host "   curl -H 'Authorization: Bearer YOUR_CRON_SECRET' https://your-app.vercel.app/api/cron/update-nbg-rates"
