# Simple Security Check Script for Trekk Tribe
# Run this before committing to check for security issues

Write-Host "Running security checks..." -ForegroundColor Yellow

$hasErrors = $false

# Check for .env files (most critical)
$envFiles = git diff --cached --name-only | Where-Object { $_ -match "\.env$" }
if ($envFiles) {
    Write-Host "ERROR: Found .env file in commit. Environment files should not be committed!" -ForegroundColor Red
    $hasErrors = $true
}

# Check for log files
$logFiles = git diff --cached --name-only | Where-Object { $_ -match "\.log$" -or $_ -match "logs/" }
if ($logFiles) {
    Write-Host "ERROR: Found log files in commit!" -ForegroundColor Red
    $hasErrors = $true
}

# Check for upload directories
$uploadDirs = git diff --cached --name-only | Where-Object { $_ -match "uploads/" }
if ($uploadDirs) {
    Write-Host "ERROR: Found upload directory in commit!" -ForegroundColor Red
    $hasErrors = $true
}

# Check for WhatsApp session data
$whatsappData = git diff --cached --name-only | Where-Object { $_ -match "\.wwebjs" }
if ($whatsappData) {
    Write-Host "ERROR: Found WhatsApp session data in commit!" -ForegroundColor Red
    $hasErrors = $true
}

if ($hasErrors) {
    Write-Host ""
    Write-Host "COMMIT BLOCKED due to security issues!" -ForegroundColor Red
    Write-Host "Please fix the issues above before committing." -ForegroundColor Red
    exit 1
} else {
    Write-Host "SUCCESS: Security checks passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Security reminders:" -ForegroundColor Cyan
    Write-Host "  - Never commit .env files" -ForegroundColor White
    Write-Host "  - Don't commit log files or uploads" -ForegroundColor White
    Write-Host "  - Use environment variables for secrets" -ForegroundColor White
    Write-Host ""
}
