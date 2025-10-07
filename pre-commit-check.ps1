# PowerShell Pre-commit Security Check Script
# Run this before committing to check for security issues

Write-Host "🔒 Running security checks..." -ForegroundColor Yellow

$hasErrors = $false

# Check for .env files
$envFiles = git diff --cached --name-only | Where-Object { $_ -match "\.env$" }
if ($envFiles) {
    Write-Host "❌ Found .env file in commit. Environment files should not be committed!" -ForegroundColor Red
    Write-Host "Please remove .env files from your commit and add them to .gitignore" -ForegroundColor Red
    $hasErrors = $true
}

# Check for hardcoded secrets
$secrets = git diff --cached | Select-String -Pattern "(password|secret|key|token|credential)" -CaseSensitive:$false | 
    Where-Object { $_ -notmatch "process\.env\." -and $_ -notmatch "your_.*_here" -and $_ -notmatch "placeholder" -and $_ -notmatch "example" -and $_ -notmatch "template" }

if ($secrets) {
    Write-Host "⚠️ Potential secrets found in commit. Please review:" -ForegroundColor Yellow
    $secrets | Select-Object -First 5 | ForEach-Object { Write-Host "   $($_.Line.Trim())" -ForegroundColor Yellow }
    Write-Host ""
    Write-Host "Make sure no actual secrets are committed!" -ForegroundColor Yellow
}

# Check for hardcoded database URLs
$dbUrls = git diff --cached | Select-String -Pattern "mongodb://.*:.*@" -CaseSensitive:$false
if ($dbUrls) {
    Write-Host "❌ Found hardcoded database credentials in commit!" -ForegroundColor Red
    Write-Host "Database credentials should be in environment variables only" -ForegroundColor Red
    $hasErrors = $true
}

# Check for hardcoded JWT secrets
$jwtSecrets = git diff --cached | Select-String -Pattern "jwt.*secret.*=.*['`"][^'`"]{10,}" -CaseSensitive:$false
if ($jwtSecrets) {
    Write-Host "❌ Found hardcoded JWT secret in commit!" -ForegroundColor Red
    Write-Host "JWT secrets should be in environment variables only" -ForegroundColor Red
    $hasErrors = $true
}

# Check for log files
$logFiles = git diff --cached --name-only | Where-Object { $_ -match "\.log$" -or $_ -match "logs/" }
if ($logFiles) {
    Write-Host "❌ Found log files in commit!" -ForegroundColor Red
    Write-Host "Log files should not be committed" -ForegroundColor Red
    $hasErrors = $true
}

# Check for upload directories
$uploadDirs = git diff --cached --name-only | Where-Object { $_ -match "uploads/" }
if ($uploadDirs) {
    Write-Host "❌ Found upload directory in commit!" -ForegroundColor Red
    Write-Host "Upload directories should not be committed" -ForegroundColor Red
    $hasErrors = $true
}

# Check for WhatsApp session data
$whatsappData = git diff --cached --name-only | Where-Object { $_ -match "\.wwebjs" }
if ($whatsappData) {
    Write-Host "❌ Found WhatsApp session data in commit!" -ForegroundColor Red
    Write-Host "WhatsApp session data should not be committed" -ForegroundColor Red
    $hasErrors = $true
}

if ($hasErrors) {
    Write-Host ""
    Write-Host "🚫 Commit blocked due to security issues!" -ForegroundColor Red
    Write-Host "Please fix the issues above before committing." -ForegroundColor Red
    exit 1
} else {
    Write-Host "✅ Security checks passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🔐 Security reminders:" -ForegroundColor Cyan
    Write-Host "   - Never commit .env files" -ForegroundColor White
    Write-Host "   - Use environment variables for all secrets" -ForegroundColor White
    Write-Host "   - Don't commit log files or uploads" -ForegroundColor White
    Write-Host "   - Use strong, unique secrets" -ForegroundColor White
    Write-Host ""
}