# Automatic Git Sync - Run this to sync with colleague every 5 minutes
# Usage: .\scripts\continuous-sync.ps1


param(
    [int]$IntervalMinutes = 5,
    [string]$Branch = "main"
)

function Show-Notification {
    param([string]$Message, [string]$Title = "Git Sync")
    Add-Type -AssemblyName System.Windows.Forms
    $notify = New-Object System.Windows.Forms.NotifyIcon
    $notify.Icon = [System.Drawing.SystemIcons]::Information
    $notify.BalloonTipTitle = $Title
    $notify.BalloonTipText = $Message
    $notify.Visible = $true
    $notify.ShowBalloonTip(5000)
    Start-Sleep -Seconds 5
    $notify.Dispose()
}

$LogFile = "sync-log.txt"
function Log-Event {
    param([string]$Message)
    Add-Content -Path $LogFile -Value ("[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message")
}


Write-Host "🔄 Continuous Git Sync Started" -ForegroundColor Green
Write-Host "Syncing every $IntervalMinutes minutes on branch '$Branch'" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop`n" -ForegroundColor Gray
Log-Event "Sync started on branch '$Branch' every $IntervalMinutes minutes."


$IntervalSeconds = $IntervalMinutes * 60


while ($true) {
    $timestamp = Get-Date -Format "HH:mm:ss"
    try {
        # Exclude .env.local from commit
        $status = git status --porcelain | Where-Object { $_ -notmatch ".env.local" }
        if ($status) {
            Write-Host "[$timestamp] 💾 Committing your changes..." -ForegroundColor Yellow
            git add .
            git reset .env.local
            git commit -m "auto-sync: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" --quiet
            Log-Event "Committed local changes."
        }

        # Auto-stash before pull
        Write-Host "[$timestamp] 📦 Stashing local changes before pull..." -ForegroundColor Magenta
        git stash --include-untracked --quiet
        Log-Event "Stashed local changes."

        # Pull colleague's changes
        Write-Host "[$timestamp] ⬇️  Pulling colleague's changes from $Branch..." -ForegroundColor Cyan
        $pullResult = git pull origin $Branch 2>&1
        if ($LASTEXITCODE -eq 0) {
            if ($pullResult -match "Already up to date") {
                Write-Host "[$timestamp] ✓ Already synced" -ForegroundColor Gray
                Log-Event "Already up to date."
            } else {
                Write-Host "[$timestamp] ✅ Synced with colleague's changes!" -ForegroundColor Green
                Log-Event "Pulled and merged changes."
                Show-Notification "Pulled and merged changes from $Branch." "Git Sync"
            }
        } else {
            Write-Host "[$timestamp] ⚠️  Merge conflict - manual resolution needed" -ForegroundColor Red
            Log-Event "Merge conflict detected. Manual resolution needed."
            Show-Notification "Merge conflict detected! Manual resolution required." "Git Sync Error"
        }

        # Pop stash after pull
        Write-Host "[$timestamp] 📦 Restoring stashed changes..." -ForegroundColor Magenta
        git stash pop --quiet
        Log-Event "Restored stashed changes."

        # Push your changes
        if ($status) {
            Write-Host "[$timestamp] ⬆️  Pushing your changes to $Branch..." -ForegroundColor Cyan
            git push origin $Branch --quiet
            Write-Host "[$timestamp] ✅ Your changes shared!" -ForegroundColor Green
            Log-Event "Pushed local changes."
            Show-Notification "Your changes pushed to $Branch." "Git Sync"
        }

    } catch {
        Write-Host "[$timestamp] ❌ Error: $_" -ForegroundColor Red
        Log-Event "Error: $_"
        Show-Notification "Error: $_" "Git Sync Error"
    }

    Write-Host "[$timestamp] 💤 Waiting $IntervalMinutes minutes...`n" -ForegroundColor Gray
    Log-Event "Waiting $IntervalMinutes minutes."
    Start-Sleep -Seconds $IntervalSeconds
}
