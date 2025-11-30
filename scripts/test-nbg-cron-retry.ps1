# Test NBG Cron Endpoint with Retry
param(
    [int]$MaxRetries = 5,
    [int]$WaitSeconds = 20
)

$CRON_SECRET = "pA0josnPQ0Qnee6B47f7ATN/GN60cNfxU3SXJKZwSQA="
$URL = "https://ice-erp.vercel.app/api/cron/update-nbg-rates"

Write-Host "🧪 Testing NBG Cron Endpoint" -ForegroundColor Cyan
Write-Host "URL: $URL" -ForegroundColor Gray
Write-Host ""

for ($i = 1; $i -le $MaxRetries; $i++) {
    Write-Host "Attempt $i of $MaxRetries..." -ForegroundColor Yellow
    
    try {
        $response = Invoke-WebRequest `
            -Uri $URL `
            -Method GET `
            -Headers @{"Authorization" = "Bearer $CRON_SECRET"} `
            -UseBasicParsing
        
        Write-Host "✅ Success! Status: $($response.StatusCode)" -ForegroundColor Green
        Write-Host ""
        Write-Host "📊 Response:" -ForegroundColor Cyan
        $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10 | Write-Host
        exit 0
        
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.Value__
        
        if ($statusCode -eq 401) {
            Write-Host "⏳ Deployment not ready yet (401 Unauthorized)" -ForegroundColor Yellow
            if ($i -lt $MaxRetries) {
                Write-Host "   Waiting $WaitSeconds seconds before retry..." -ForegroundColor Gray
                Start-Sleep -Seconds $WaitSeconds
            }
        } else {
            Write-Host "❌ Error: Status $statusCode" -ForegroundColor Red
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $responseBody = $reader.ReadToEnd()
            Write-Host "Response: $responseBody" -ForegroundColor Yellow
            exit 1
        }
    }
}

Write-Host ""
Write-Host "❌ Failed after $MaxRetries attempts" -ForegroundColor Red
Write-Host "Deployment may still be building. Check:" -ForegroundColor Yellow
Write-Host "https://vercel.com/iceerpgeorgia/ice-erp/deployments" -ForegroundColor White
