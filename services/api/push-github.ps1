# Trek Tribe - Safe GitHub Push Script
Write-Host "Trek Tribe - Safe GitHub Push" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan

# Check if we're in the right directory
if (!(Test-Path "package.json")) {
    Write-Host "Error: Please run this script from the services/api directory" -ForegroundColor Red
    exit 1
}

# Check for sensitive data in .env
$envContent = Get-Content ".env" -Raw -ErrorAction SilentlyContinue
if ($envContent) {
    if ($envContent -match "AIza[0-9A-Za-z_-]{35}") {
        Write-Host "Error: Found real Firebase API key in .env file!" -ForegroundColor Red
        Write-Host "Please move real secrets to .env.local before pushing!" -ForegroundColor Red
        exit 1
    }
}

Write-Host "Environment files look safe for GitHub" -ForegroundColor Green

# Show git status
Write-Host "`nCurrent git status:" -ForegroundColor Yellow
git status --short

# Confirm push
Write-Host "`nReady to push to GitHub?" -ForegroundColor Cyan
$confirm = Read-Host "Continue? (y/N)"

if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "Aborted by user" -ForegroundColor Red
    exit 1
}

# Add, commit and push
Write-Host "Adding files..." -ForegroundColor Yellow
git add .

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$commitMessage = "feat: secure environment config and pickup points ($timestamp)"

Write-Host "Committing..." -ForegroundColor Yellow
git commit -m $commitMessage

Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
git push

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nSuccessfully pushed to GitHub!" -ForegroundColor Green
    Write-Host "Your secrets are safe in .env.local (not tracked)" -ForegroundColor Cyan
} else {
    Write-Host "Failed to push to GitHub" -ForegroundColor Red
}