# Test NBG Cron Endpoint
# This script tests the NBG rates cron endpoint

$CRON_SECRET = $env:CRON_SECRET
if (-not $CRON_SECRET) {
    Write-Host "❌ CRON_SECRET environment variable not set" -ForegroundColor Red
    Write-Host ""
    Write-Host "To set it temporarily:"
    Write-Host '  $env:CRON_SECRET = "your-secret-here"' -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Or add to .env.local and restart your terminal"
    exit 1
}

$BASE_URL = "http://localhost:3000"
if ($args[0]) {
    $BASE_URL = $args[0]
}

Write-Host "🧪 Testing NBG Cron Endpoint" -ForegroundColor Cyan
Write-Host "URL: $BASE_URL/api/cron/update-nbg-rates" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-WebRequest `
        -Uri "$BASE_URL/api/cron/update-nbg-rates" `
        -Method GET `
        -Headers @{
            "Authorization" = "Bearer $CRON_SECRET"
        } `
        -UseBasicParsing

    Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Response:" -ForegroundColor Cyan
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10 | Write-Host
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host ""
        Write-Host "Response body:" -ForegroundColor Yellow
        Write-Host $responseBody
    }
}
