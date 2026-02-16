# Trek Tribe - Comprehensive Feature Testing Script
# This script tests all features including email service, OTP service, and password reset

Write-Host "🚀 Trek Tribe - Comprehensive Feature Testing" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# Check if API is running
Write-Host "🔍 Checking if API server is running..." -ForegroundColor Yellow
$apiUrl = "http://localhost:4000"

try {
    $response = Invoke-WebRequest -Uri "$apiUrl/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ API server is running" -ForegroundColor Green
} catch {
    Write-Host "❌ API server is not running!" -ForegroundColor Red
    Write-Host "Please start the API server first:" -ForegroundColor Yellow
    Write-Host "  cd services/api" -ForegroundColor White
    Write-Host "  npm run dev" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "📧 Email Configuration Check" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan

# Check .env file
$envFile = "services/api/.env"
if (Test-Path $envFile) {
    Write-Host "✅ .env file found" -ForegroundColor Green
    
    # Check for required email variables
    $envContent = Get-Content $envFile -Raw
    
    if ($envContent -match "EMAIL_USER=") {
        Write-Host "✅ EMAIL_USER is configured" -ForegroundColor Green
    } else {
        Write-Host "⚠️  EMAIL_USER is not configured" -ForegroundColor Yellow
    }
    
    if ($envContent -match "EMAIL_PASSWORD=") {
        Write-Host "✅ EMAIL_PASSWORD is configured" -ForegroundColor Green
    } else {
        Write-Host "⚠️  EMAIL_PASSWORD is not configured" -ForegroundColor Yellow
    }
    
    if ($envContent -match "DISABLE_EMAIL=false") {
        Write-Host "✅ Email service is enabled" -ForegroundColor Green
    } elseif ($envContent -match "DISABLE_EMAIL=true") {
        Write-Host "⚠️  Email service is DISABLED" -ForegroundColor Yellow
        Write-Host "   Set DISABLE_EMAIL=false in .env to enable emails" -ForegroundColor White
    }
} else {
    Write-Host "❌ .env file not found!" -ForegroundColor Red
    Write-Host "Please create .env file from .env.example" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📋 Test Menu" -ForegroundColor Cyan
Write-Host "============" -ForegroundColor Cyan
Write-Host "1. Run Automated Tests (Jest)" -ForegroundColor White
Write-Host "2. Run Manual Email Testing Tool (Interactive)" -ForegroundColor White
Write-Host "3. Test Registration with OTP" -ForegroundColor White
Write-Host "4. Test Password Reset" -ForegroundColor White
Write-Host "5. Test Email Service Status" -ForegroundColor White
Write-Host "6. Run All API Tests" -ForegroundColor White
Write-Host "0. Exit" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Enter your choice"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "🧪 Running Automated Email/OTP Tests..." -ForegroundColor Cyan
        Write-Host ""
        Set-Location services/api
        npm run test:email
        Set-Location ../..
    }
    "2" {
        Write-Host ""
        Write-Host "🔧 Starting Manual Email Testing Tool..." -ForegroundColor Cyan
        Write-Host ""
        Set-Location services/api
        npm run test:email:manual
        Set-Location ../..
    }
    "3" {
        Write-Host ""
        Write-Host "📝 Testing Registration with OTP..." -ForegroundColor Cyan
        Write-Host ""
        
        $email = Read-Host "Enter test email address (default: tanejs404@gmail.com)"
        if ([string]::IsNullOrWhiteSpace($email)) {
            $email = "tanejs404@gmail.com"
        }
        
        Write-Host ""
        Write-Host "📤 Sending registration request..." -ForegroundColor Yellow
        
        $body = @{
            email = $email
            password = "TestPassword123!"
            name = "Test User"
            phone = "+919876543210"
            role = "traveler"
        } | ConvertTo-Json
        
        try {
            $response = Invoke-RestMethod -Uri "$apiUrl/auth/register" -Method POST -Body $body -ContentType "application/json"
            
            Write-Host "✅ Registration successful!" -ForegroundColor Green
            Write-Host ""
            Write-Host "Response:" -ForegroundColor Cyan
            Write-Host ($response | ConvertTo-Json -Depth 10) -ForegroundColor White
            Write-Host ""
            Write-Host "📬 Please check your email at: $email" -ForegroundColor Yellow
            Write-Host "🔢 You should receive a 6-digit OTP code" -ForegroundColor Yellow
            Write-Host ""
            
            if ($response.otp) {
                Write-Host "🔢 OTP (Development Mode): $($response.otp)" -ForegroundColor Green
            }
            
            $verifyOtp = Read-Host "Enter the OTP you received (or press Enter to skip verification)"
            
            if (-not [string]::IsNullOrWhiteSpace($verifyOtp)) {
                Write-Host ""
                Write-Host "✅ Verifying OTP..." -ForegroundColor Yellow
                
                $verifyBody = @{
                    userId = $response.userId
                    email = $email
                    otp = $verifyOtp
                } | ConvertTo-Json
                
                try {
                    $verifyResponse = Invoke-RestMethod -Uri "$apiUrl/auth/verify-registration-email" -Method POST -Body $verifyBody -ContentType "application/json"
                    
                    Write-Host "✅ Email verified successfully!" -ForegroundColor Green
                    Write-Host ""
                    Write-Host "Response:" -ForegroundColor Cyan
                    Write-Host ($verifyResponse | ConvertTo-Json -Depth 10) -ForegroundColor White
                } catch {
                    Write-Host "❌ OTP verification failed!" -ForegroundColor Red
                    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
                }
            }
        } catch {
            Write-Host "❌ Registration failed!" -ForegroundColor Red
            Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    "4" {
        Write-Host ""
        Write-Host "🔐 Testing Password Reset..." -ForegroundColor Cyan
        Write-Host ""
        
        $email = Read-Host "Enter email address for password reset (default: tanejs404@gmail.com)"
        if ([string]::IsNullOrWhiteSpace($email)) {
            $email = "tanejs404@gmail.com"
        }
        
        Write-Host ""
        Write-Host "📤 Sending password reset request..." -ForegroundColor Yellow
        
        $body = @{
            email = $email
        } | ConvertTo-Json
        
        try {
            $response = Invoke-RestMethod -Uri "$apiUrl/auth/forgot-password" -Method POST -Body $body -ContentType "application/json"
            
            Write-Host "✅ Password reset email sent!" -ForegroundColor Green
            Write-Host ""
            Write-Host "Response:" -ForegroundColor Cyan
            Write-Host ($response | ConvertTo-Json -Depth 10) -ForegroundColor White
            Write-Host ""
            Write-Host "📬 Please check your email at: $email" -ForegroundColor Yellow
            Write-Host "🔗 You should receive a password reset link" -ForegroundColor Yellow
        } catch {
            Write-Host "❌ Password reset request failed!" -ForegroundColor Red
            Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    "5" {
        Write-Host ""
        Write-Host "📊 Checking Email Service Status..." -ForegroundColor Cyan
        Write-Host ""
        
        try {
            $response = Invoke-RestMethod -Uri "$apiUrl/health" -Method GET
            
            Write-Host "✅ API Health Check:" -ForegroundColor Green
            Write-Host ($response | ConvertTo-Json -Depth 10) -ForegroundColor White
            Write-Host ""
            Write-Host "Note: Email service status is checked internally" -ForegroundColor Yellow
            Write-Host "Check the API logs for detailed email service status" -ForegroundColor Yellow
        } catch {
            Write-Host "❌ Health check failed!" -ForegroundColor Red
            Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    "6" {
        Write-Host ""
        Write-Host "🧪 Running All API Tests..." -ForegroundColor Cyan
        Write-Host ""
        Set-Location services/api
        npm test
        Set-Location ../..
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
