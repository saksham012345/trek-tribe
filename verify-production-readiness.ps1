# Trek Tribe Production Readiness Verification Script
# This script checks for common issues that could prevent deployment

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Trek Tribe Production Readiness Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$issues = @()
$warnings = @()
$passed = @()

# Function to check file exists
function Test-FileExists {
    param($path, $description)
    if (Test-Path $path) {
        $script:passed += "✓ $description"
        return $true
    } else {
        $script:issues += "✗ $description - File not found: $path"
        return $false
    }
}

# Function to check environment variable in file
function Test-EnvVariable {
    param($file, $variable, $description)
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        if ($content -match $variable) {
            $script:passed += "✓ $description"
            return $true
        } else {
            $script:warnings += "⚠ $description - Variable not found in $file"
            return $false
        }
    } else {
        $script:warnings += "⚠ $description - File not found: $file"
        return $false
    }
}

Write-Host "1. Checking Frontend Configuration..." -ForegroundColor Yellow
Write-Host ""

# Check package.json
Test-FileExists "web/package.json" "Frontend package.json exists"

# Check for lodash dependency
if (Test-Path "web/package.json") {
    $packageJson = Get-Content "web/package.json" -Raw | ConvertFrom-Json
    if ($packageJson.dependencies.lodash) {
        $passed += "✓ lodash dependency present in package.json"
    } else {
        $issues += "✗ lodash dependency missing in package.json"
    }
    
    if ($packageJson.devDependencies.'@types/lodash') {
        $passed += "✓ @types/lodash present in devDependencies"
    } else {
        $warnings += "⚠ @types/lodash missing in devDependencies"
    }
}

# Check frontend env example
Test-FileExists "web/.env.example" "Frontend .env.example exists"

Write-Host ""
Write-Host "2. Checking Backend Configuration..." -ForegroundColor Yellow
Write-Host ""

# Check backend package.json
Test-FileExists "services/api/package.json" "Backend package.json exists"

# Check backend env
Test-FileExists "services/api/.env.example" "Backend .env.example exists"

# Check critical backend files
Test-FileExists "services/api/src/index.ts" "Backend entry point exists"
Test-FileExists "services/api/Dockerfile" "Backend Dockerfile exists"

Write-Host ""
Write-Host "3. Checking Docker Configuration..." -ForegroundColor Yellow
Write-Host ""

Test-FileExists "docker-compose.yml" "Docker Compose file exists"
Test-FileExists "ai-service/Dockerfile" "AI Service Dockerfile exists"

Write-Host ""
Write-Host "4. Checking Critical Environment Variables..." -ForegroundColor Yellow
Write-Host ""

# Check if .env files exist (not .example)
if (Test-Path "services/api/.env") {
    Test-EnvVariable "services/api/.env" "MONGODB_URI" "MongoDB URI configured"
    Test-EnvVariable "services/api/.env" "JWT_SECRET" "JWT Secret configured"
    Test-EnvVariable "services/api/.env" "RAZORPAY_KEY_ID" "Razorpay Key ID configured"
    Test-EnvVariable "services/api/.env" "RAZORPAY_KEY_SECRET" "Razorpay Key Secret configured"
} else {
    $warnings += "⚠ Backend .env file not found (using .env.example as reference)"
}

Write-Host ""
Write-Host "5. Checking TypeScript Configuration..." -ForegroundColor Yellow
Write-Host ""

Test-FileExists "web/tsconfig.json" "Frontend TypeScript config exists"
Test-FileExists "services/api/tsconfig.json" "Backend TypeScript config exists"

Write-Host ""
Write-Host "6. Checking Build Scripts..." -ForegroundColor Yellow
Write-Host ""

if (Test-Path "web/package.json") {
    $packageJson = Get-Content "web/package.json" -Raw | ConvertFrom-Json
    if ($packageJson.scripts.build) {
        $passed += "✓ Frontend build script exists"
    } else {
        $issues += "✗ Frontend build script missing"
    }
}

if (Test-Path "services/api/package.json") {
    $packageJson = Get-Content "services/api/package.json" -Raw | ConvertFrom-Json
    if ($packageJson.scripts.build) {
        $passed += "✓ Backend build script exists"
    } else {
        $issues += "✗ Backend build script missing"
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "VERIFICATION RESULTS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($passed.Count -gt 0) {
    Write-Host "PASSED CHECKS ($($passed.Count)):" -ForegroundColor Green
    foreach ($item in $passed) {
        Write-Host "  $item" -ForegroundColor Green
    }
    Write-Host ""
}

if ($warnings.Count -gt 0) {
    Write-Host "WARNINGS ($($warnings.Count)):" -ForegroundColor Yellow
    foreach ($item in $warnings) {
        Write-Host "  $item" -ForegroundColor Yellow
    }
    Write-Host ""
}

if ($issues.Count -gt 0) {
    Write-Host "CRITICAL ISSUES ($($issues.Count)):" -ForegroundColor Red
    foreach ($item in $issues) {
        Write-Host "  $item" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "❌ Production readiness check FAILED" -ForegroundColor Red
    Write-Host "Please fix the critical issues above before deploying." -ForegroundColor Red
    exit 1
} else {
    Write-Host "✅ Production readiness check PASSED" -ForegroundColor Green
    Write-Host ""
    if ($warnings.Count -gt 0) {
        Write-Host "Note: There are $($warnings.Count) warning(s) that should be reviewed." -ForegroundColor Yellow
    }
    exit 0
}
