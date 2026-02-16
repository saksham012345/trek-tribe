# Trek Tribe - Quick Test Starter
# This script checks prerequisites and starts testing

Write-Host ""
Write-Host "🚀 Trek Tribe - Email & OTP Testing" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check if we're in the right directory
if (-not (Test-Path "services/api")) {
    Write-Host "❌ Error: services/api directory not found!" -ForegroundColor Red
    Write-Host "Please run this script from the project root directory" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Project directory verified" -ForegroundColor Green

# Step 2: Check if .env exists
if (-not (Test-Path "services/api/.env")) {
    Write-Host "❌ Error: .env file not found!" -ForegroundColor Red
    Write-Host "Please create services/api/.env from .env.example" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ .env file found" -ForegroundColor Green

# Step 3: Check email configuration
$envContent = Get-Content "services/api/.env" -Raw

if ($envContent -notmatch "EMAIL_USER=") {
    Write-Host "⚠️  Warning: EMAIL_USER not configured in .env" -ForegroundColor Yellow
} else {
    Write-Host "✅ EMAIL_USER configured" -ForegroundColor Green
}

if ($envContent -notmatch "EMAIL_PASSWORD=") {
    Write-Host "⚠️  Warning: EMAIL_PASSWORD not configured in .env" -ForegroundColor Yellow
} else {
    Write-Host "✅ EMAIL_PASSWORD configured" -ForegroundColor Green
}

if ($envContent -match "DISABLE_EMAIL=false") {
    Write-Host "✅ Email service enabled" -ForegroundColor Green
} else {
    Write-Host "⚠️  Warning: Email service might be disabled" -ForegroundColor Yellow
}

# Step 4: Check if node_modules exists
if (-not (Test-Path "services/api/node_modules")) {
    Write-Host ""
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    Set-Location services/api
    npm install
    Set-Location ../..
    Write-Host "✅ Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "✅ Dependencies already installed" -ForegroundColor Green
}

# Step 5: Check if API is running
Write-Host ""
Write-Host "🔍 Checking if API server is running..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri "http://localhost:4000/health" -Method GET -TimeoutSec 3 -ErrorAction Stop
    Write-Host "✅ API server is already running!" -ForegroundColor Green
    $apiRunning = $true
} catch {
    Write-Host "⚠️  API server is not running" -ForegroundColor Yellow
    $apiRunning = $false
}

# Step 6: Start API if not running
if (-not $apiRunning) {
    Write-Host ""
    Write-Host "🚀 Starting API server..." -ForegroundColor Cyan
    Write-Host "This will open a new window. Please wait..." -ForegroundColor Yellow
    Write-Host ""
    
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd services/api; npm run dev"
    
    Write-Host "⏳ Waiting for API to start (30 seconds)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    
    # Check if API started
    $attempts = 0
    $maxAttempts = 10
    $apiStarted = $false
    
    while ($attempts -lt $maxAttempts -and -not $apiStarted) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:4000/health" -Method GET -TimeoutSec 2 -ErrorAction Stop
            $apiStarted = $true
            Write-Host "✅ API server started successfully!" -ForegroundColor Green
        } catch {
            $attempts++
            Write-Host "." -NoNewline
            Start-Sleep -Seconds 2
        }
    }
    
    if (-not $apiStarted) {
        Write-Host ""
        Write-Host "⚠️  API server might still be starting..." -ForegroundColor Yellow
        Write-Host "Please check the API server window for any errors" -ForegroundColor Yellow
        Write-Host ""
        $continue = Read-Host "Continue anyway? (y/n)"
        if ($continue -ne "y") {
            exit 1
        }
    }
}

# Step 7: Show test information
Write-Host ""
Write-Host "📧 Test Email Information" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan
Write-Host "Test Email: tanejs404@gmail.com" -ForegroundColor White
Write-Host "You will receive OTP codes at this email address" -ForegroundColor White
Write-Host ""

# Step 8: Ask what to do
Write-Host "🎯 What would you like to do?" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan
Write-Host "1. Run Quick Registration Test (Recommended)" -ForegroundColor White
Write-Host "2. Run Full Test Suite" -ForegroundColor White
Write-Host "3. Run Interactive Testing Tool" -ForegroundColor White
Write-Host "4. Open Testing Guide" -ForegroundColor White
Write-Host "0. Exit" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Enter your choice"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "🧪 Running Quick Registration Test..." -ForegroundColor Cyan
        Write-Host ""
        
        # Run the PowerShell test script with auto-selection
        $email = "tanejs404@gmail.com"
        
        Write-Host "📤 Registering user with email: $email" -ForegroundColor Yellow
        Write-Host ""
        
        $body = @{
            email = $email
            password = "TestPassword123!"
            name = "Test User"
            phone = "+919876543210"
            role = "traveler"
        } | ConvertTo-Json
        
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:4000/auth/register" -Method POST -Body $body -ContentType "application/json"
            
            Write-Host "✅ Registration successful!" -ForegroundColor Green
            Write-Host ""
            Write-Host "📬 CHECK YOUR EMAIL NOW!" -ForegroundColor Yellow -BackgroundColor DarkBlue
            Write-Host "Email: $email" -ForegroundColor White
            Write-Host ""
            
            if ($response.otp) {
                Write-Host "🔢 OTP (Development Mode): $($response.otp)" -ForegroundColor Green
                Write-Host ""
            }
            
            Write-Host "Response Details:" -ForegroundColor Cyan
            Write-Host ($response | ConvertTo-Json -Depth 10) -ForegroundColor White
            Write-Host ""
            
            Write-Host "⏳ Waiting for you to check your email..." -ForegroundColor Yellow
            $otp = Read-Host "Enter the OTP you received (or press Enter to skip)"
            
            if (-not [string]::IsNullOrWhiteSpace($otp)) {
                Write-Host ""
                Write-Host "✅ Verifying OTP..." -ForegroundColor Yellow
                
                $verifyBody = @{
                    userId = $response.userId
                    email = $email
                    otp = $otp.Trim()
                } | ConvertTo-Json
                
                try {
                    $verifyResponse = Invoke-RestMethod -Uri "http://localhost:4000/auth/verify-registration-email" -Method POST -Body $verifyBody -ContentType "application/json"
                    
                    Write-Host ""
                    Write-Host "🎉 SUCCESS! Email verified!" -ForegroundColor Green -BackgroundColor DarkGreen
                    Write-Host ""
                    Write-Host "Response:" -ForegroundColor Cyan
                    Write-Host ($verifyResponse | ConvertTo-Json -Depth 10) -ForegroundColor White
                    Write-Host ""
                    Write-Host "✅ Test completed successfully!" -ForegroundColor Green
                    Write-Host ""
                    Write-Host "📊 Summary:" -ForegroundColor Cyan
                    Write-Host "  ✅ User registered" -ForegroundColor Green
                    Write-Host "  ✅ Email sent" -ForegroundColor Green
                    Write-Host "  ✅ OTP verified" -ForegroundColor Green
                    Write-Host "  ✅ User can now login" -ForegroundColor Green
                } catch {
                    Write-Host ""
                    Write-Host "❌ OTP verification failed!" -ForegroundColor Red
                    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
                    Write-Host ""
                    Write-Host "Possible reasons:" -ForegroundColor Yellow
                    Write-Host "  - OTP expired (10 minute limit)" -ForegroundColor White
                    Write-Host "  - OTP was typed incorrectly" -ForegroundColor White
                    Write-Host "  - Too many attempts (5 max)" -ForegroundColor White
                }
            } else {
                Write-Host ""
                Write-Host "⏭️  Skipped OTP verification" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "❌ Registration failed!" -ForegroundColor Red
            Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    "2" {
        Write-Host ""
        Write-Host "🧪 Running Full Test Suite..." -ForegroundColor Cyan
        Write-Host ""
        Set-Location services/api
        npm run test:email
        Set-Location ../..
    }
    "3" {
        Write-Host ""
        Write-Host "🔧 Starting Interactive Testing Tool..." -ForegroundColor Cyan
        Write-Host ""
        Set-Location services/api
        npm run test:email:manual
        Set-Location ../..
    }
    "4" {
        Write-Host ""
        Write-Host "📖 Opening Testing Guide..." -ForegroundColor Cyan
        Start-Process "TESTING_GUIDE.md"
        Start-Process "QUICK_TEST_INSTRUCTIONS.md"
        Start-Process "TEST_SUMMARY.md"
    }
    "0" {
        Write-Host ""
        Write-Host "👋 Goodbye!" -ForegroundColor Cyan
        exit 0
    }
    default {
        Write-Host ""
        Write-Host "❌ Invalid choice!" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
