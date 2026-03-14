# Trek Tribe Dependency Fix Script
# This script fixes missing dependencies and common issues

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Trek Tribe Dependency Fix" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Continue"

# Check if we're in the right directory
if (-not (Test-Path "web/package.json")) {
    Write-Host "❌ Error: Must run this script from the trek-tribe root directory" -ForegroundColor Red
    exit 1
}

Write-Host "1. Installing Frontend Dependencies..." -ForegroundColor Yellow
Write-Host ""

Push-Location web

try {
    Write-Host "Installing lodash and @types/lodash..." -ForegroundColor Cyan
    npm install lodash@^4.17.21 --save
    npm install @types/lodash@^4.14.202 --save-dev
    
    Write-Host "✓ Frontend dependencies installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Error installing frontend dependencies: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}

Pop-Location

Write-Host ""
Write-Host "2. Verifying Installation..." -ForegroundColor Yellow
Write-Host ""

Push-Location web

try {
    $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
    
    if ($packageJson.dependencies.lodash) {
        Write-Host "✓ lodash installed: $($packageJson.dependencies.lodash)" -ForegroundColor Green
    } else {
        Write-Host "⚠ lodash not found in dependencies" -ForegroundColor Yellow
    }
    
    if ($packageJson.devDependencies.'@types/lodash') {
        Write-Host "✓ @types/lodash installed: $($packageJson.devDependencies.'@types/lodash')" -ForegroundColor Green
    } else {
        Write-Host "⚠ @types/lodash not found in devDependencies" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Error verifying installation: $_" -ForegroundColor Red
}

Pop-Location

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Fix Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Run: cd web && npm run build" -ForegroundColor White
Write-Host "2. Check for any remaining TypeScript errors" -ForegroundColor White
Write-Host "3. Test the application locally before deploying" -ForegroundColor White
Write-Host ""
