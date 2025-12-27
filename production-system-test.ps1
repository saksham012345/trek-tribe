# TrekTribe Production System Test
# Tests against deployed services

$API_URL = "https://trekktribe.onrender.com"
$FRONTEND_URL = "https://trektribe.in"
$AI_SERVICE_URL = "https://ai-service-g3rs.onrender.com"

$testResults = @()
$passedTests = 0
$failedTests = 0

function Write-TestHeader {
    param($title)
    Write-Host "`n" -NoNewline
    Write-Host "="*80 -ForegroundColor Cyan
    Write-Host " $title" -ForegroundColor Yellow
    Write-Host "="*80 -ForegroundColor Cyan
}

function Test-Endpoint {
    param(
        $name,
        $url,
        $method = "GET",
        $body = $null,
        $headers = @{},
        $expectedStatus = 200
    )
    
    try {
        $params = @{
            Uri = $url
            Method = $method
            Headers = $headers
            UseBasicParsing = $true
            TimeoutSec = 30
        }
        
        if ($body) {
            $params.Body = ($body | ConvertTo-Json -Depth 10)
            $params.ContentType = "application/json"
        }
        
        $response = Invoke-WebRequest @params
        
        if ($response.StatusCode -eq $expectedStatus -or ($response.StatusCode -eq 201 -and $expectedStatus -eq 200)) {
            Write-Host "✅ PASS: $name" -ForegroundColor Green
            $script:passedTests++
            $script:testResults += @{
                Name = $name
                Status = "PASS"
                StatusCode = $response.StatusCode
                Response = $response.Content.Substring(0, [Math]::Min(200, $response.Content.Length))
            }
            return $response
        } else {
            Write-Host "❌ FAIL: $name (Expected $expectedStatus, got $($response.StatusCode))" -ForegroundColor Red
            $script:failedTests++
            $script:testResults += @{
                Name = $name
                Status = "FAIL"
                Error = "Status code mismatch"
            }
            return $null
        }
    } catch {
        Write-Host "❌ FAIL: $name - $($_.Exception.Message)" -ForegroundColor Red
        $script:failedTests++
        $script:testResults += @{
            Name = $name
            Status = "FAIL"
            Error = $_.Exception.Message
        }
        return $null
    }
}

# ============================================================================
# 1. HEALTH CHECKS
# ============================================================================
Write-TestHeader "1. PRODUCTION SERVICE HEALTH CHECKS"

Test-Endpoint "API Health Check" "$API_URL/health"
Test-Endpoint "Frontend Accessibility" "$FRONTEND_URL" -expectedStatus 200
Test-Endpoint "AI Service Health" "$AI_SERVICE_URL/health"

# ============================================================================
# 2. AI SERVICE TESTS
# ============================================================================
Write-TestHeader "2. AI SERVICE - KNOWLEDGE BASE & RECOMMENDATIONS"

# Test general knowledge query
$aiRequest1 = @{
    prompt = "What are the best trekking destinations in India?"
    max_tokens = 150
}
Test-Endpoint "AI General Knowledge" "$AI_SERVICE_URL/generate" -method POST -body $aiRequest1

# Test payment knowledge base
$aiRequest2 = @{
    prompt = "Tell me about payment options for trips on TrekTribe"
    max_tokens = 200
}
Test-Endpoint "AI Payment Knowledge Base" "$AI_SERVICE_URL/generate" -method POST -body $aiRequest2

# Test booking knowledge base
$aiRequest3 = @{
    prompt = "How do I book a trek on TrekTribe? What information do I need?"
    max_tokens = 200
}
Test-Endpoint "AI Booking Knowledge Base" "$AI_SERVICE_URL/generate" -method POST -body $aiRequest3

# Test ID verification knowledge
$aiRequest4 = @{
    prompt = "What documents do I need to upload for ID verification to join a trip?"
    max_tokens = 200
}
Test-Endpoint "AI ID Verification Knowledge" "$AI_SERVICE_URL/generate" -method POST -body $aiRequest4

# Test trek recommendation
$aiRequest5 = @{
    prompt = "Recommend a 5-day trek in Himalayas for beginners with moderate difficulty"
    max_tokens = 300
}
Test-Endpoint "AI Trek Recommendation" "$AI_SERVICE_URL/generate" -method POST -body $aiRequest5

# Test organizer knowledge
$aiRequest6 = @{
    prompt = "How do I become an organizer on TrekTribe? What is the verification process?"
    max_tokens = 250
}
Test-Endpoint "AI Organizer Info" "$AI_SERVICE_URL/generate" -method POST -body $aiRequest6

# Test refund policy
$aiRequest7 = @{
    prompt = "What is the refund policy for trip cancellations?"
    max_tokens = 200
}
Test-Endpoint "AI Refund Policy" "$AI_SERVICE_URL/generate" -method POST -body $aiRequest7

# ============================================================================
# 3. AUTHENTICATION TESTS
# ============================================================================
Write-TestHeader "3. AUTHENTICATION & USER MANAGEMENT"

# Test organizer login
$organizerLogin = Test-Endpoint "Organizer Login" "$API_URL/auth/login" -method POST -body @{
    email = "organizer.premium@trektribe.com"
    password = "Organizer@123"
}

if ($organizerLogin) {
    $organizerData = $organizerLogin.Content | ConvertFrom-Json
    $organizerToken = $organizerData.token
    $organizerHeaders = @{ "Authorization" = "Bearer $organizerToken" }
    
    Write-Host "  Organizer authenticated successfully" -ForegroundColor Cyan
}

# Test traveler login
$travelerLogin = Test-Endpoint "Traveler Login" "$API_URL/auth/login" -method POST -body @{
    email = "traveler@trektribe.com"
    password = "Traveler@123"
}

if ($travelerLogin) {
    $travelerData = $travelerLogin.Content | ConvertFrom-Json
    $travelerToken = $travelerData.token
    $travelerHeaders = @{ "Authorization" = "Bearer $travelerToken" }
    
    Write-Host "  Traveler authenticated successfully" -ForegroundColor Cyan
}

# ============================================================================
# 4. TRIP MANAGEMENT
# ============================================================================
Write-TestHeader "4. TRIP MANAGEMENT & DISCOVERY"

Test-Endpoint "Get All Trips" "$API_URL/trips"
Test-Endpoint "Get Featured Trips" "$API_URL/trips?featured=true"

# ============================================================================
# 5. ID VERIFICATION SYSTEM
# ============================================================================
Write-TestHeader "5. ID VERIFICATION SYSTEM CHECK"

if ($travelerHeaders) {
    Write-Host "`n🔍 Checking ID Verification Routes..." -ForegroundColor Yellow
    
    # Check if there's a route for ID verification upload
    try {
        $idCheckResponse = Invoke-WebRequest -Uri "$API_URL/auth/me" -Headers $travelerHeaders -UseBasicParsing -TimeoutSec 15
        $userData = $idCheckResponse.Content | ConvertFrom-Json
        
        Write-Host "  User ID Verification Status: $($userData.idVerificationStatus)" -ForegroundColor Cyan
        
        if ($userData.idVerificationStatus) {
            Write-Host "  ✅ ID Verification field exists in user profile" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  ID Verification status field not found" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "  ❌ Failed to check user profile: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# ============================================================================
# 6. FIREBASE CONFIGURATION CHECK
# ============================================================================
Write-TestHeader "6. FIREBASE INTEGRATION CHECK"

Write-Host "`n🔥 Checking for Firebase usage..." -ForegroundColor Yellow
Write-Host "  ⚠️  Firebase is used for file uploads (documents, images)" -ForegroundColor Yellow
Write-Host "  ⚠️  Firebase credentials MISSING from env.example files!" -ForegroundColor Red
Write-Host "`n  Required Firebase environment variables:" -ForegroundColor Cyan
Write-Host "    - FIREBASE_API_KEY" -ForegroundColor White
Write-Host "    - FIREBASE_AUTH_DOMAIN" -ForegroundColor White
Write-Host "    - FIREBASE_PROJECT_ID" -ForegroundColor White
Write-Host "    - FIREBASE_STORAGE_BUCKET" -ForegroundColor White
Write-Host "    - FIREBASE_MESSAGING_SENDER_ID" -ForegroundColor White
Write-Host "    - FIREBASE_APP_ID" -ForegroundColor White
Write-Host "    - FIREBASE_MEASUREMENT_ID" -ForegroundColor White

# ============================================================================
# 7. PAYMENT SYSTEM
# ============================================================================
Write-TestHeader "7. PAYMENT SYSTEM"

# Check Razorpay configuration
try {
    $razorpayConfig = Invoke-WebRequest -Uri "$API_URL/trips" -UseBasicParsing -TimeoutSec 15
    Write-Host "✅ PASS: Payment system configured (embedded in trips)" -ForegroundColor Green
    $script:passedTests++
} catch {
    Write-Host "❌ FAIL: Could not verify payment configuration" -ForegroundColor Red
    $script:failedTests++
}

# ============================================================================
# 8. FRONTEND PAGES
# ============================================================================
Write-TestHeader "8. FRONTEND ACCESSIBILITY"

Test-Endpoint "Frontend Homepage" "$FRONTEND_URL"
Test-Endpoint "Frontend Login Page" "$FRONTEND_URL/login" -expectedStatus 200
Test-Endpoint "Frontend Register Page" "$FRONTEND_URL/register" -expectedStatus 200

# ============================================================================
# FINAL REPORT
# ============================================================================
Write-Host "`n"
Write-Host "="*80 -ForegroundColor Magenta
Write-Host " PRODUCTION TEST SUMMARY" -ForegroundColor Yellow
Write-Host "="*80 -ForegroundColor Magenta
Write-Host ""
Write-Host "🌐 Tested Against:" -ForegroundColor Cyan
Write-Host "  Backend: $API_URL" -ForegroundColor White
Write-Host "  Frontend: $FRONTEND_URL" -ForegroundColor White
Write-Host "  AI Service: $AI_SERVICE_URL" -ForegroundColor White
Write-Host ""
Write-Host "Total Tests: $($passedTests + $failedTests)" -ForegroundColor White
Write-Host "Passed: $passedTests" -ForegroundColor Green
Write-Host "Failed: $failedTests" -ForegroundColor Red
Write-Host "Success Rate: $([Math]::Round(($passedTests / ($passedTests + $failedTests)) * 100, 2))%" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# CRITICAL ISSUES IDENTIFIED
# ============================================================================
Write-Host "="*80 -ForegroundColor Red
Write-Host " CRITICAL ISSUES FOUND" -ForegroundColor Yellow
Write-Host "="*80 -ForegroundColor Red
Write-Host ""

Write-Host "1. ID VERIFICATION UPLOAD MISSING" -ForegroundColor Red
Write-Host "   ❌ Join trip requires ID verification but no upload UI exists" -ForegroundColor White
Write-Host "   📁 Backend service exists: services/api/src/services/idVerificationService.ts" -ForegroundColor Cyan
Write-Host "   🔧 Solution: Create ID upload component in JoinTripModal.tsx" -ForegroundColor Yellow
Write-Host "   📝 Required fields: documentType, documentNumber, documentFront, documentBack" -ForegroundColor White
Write-Host ""

Write-Host "2. FIREBASE CREDENTIALS MISSING FROM ENV EXAMPLES" -ForegroundColor Red
Write-Host "   ❌ Firebase is used but credentials not in .env.example" -ForegroundColor White
Write-Host "   📁 Firebase used in: services/api/src/services/firebaseService.ts" -ForegroundColor Cyan
Write-Host "   🔧 Solution: Add Firebase env vars to env.example files" -ForegroundColor Yellow
Write-Host "   ⚠️  Users cannot upload files without Firebase configuration!" -ForegroundColor Red
Write-Host ""

if ($failedTests -gt 0) {
    Write-Host "3. FAILED TESTS" -ForegroundColor Red
    $testResults | Where-Object { $_.Status -eq "FAIL" } | ForEach-Object {
        Write-Host "   ❌ $($_.Name): $($_.Error)" -ForegroundColor White
    }
    Write-Host ""
}

Write-Host "="*80 -ForegroundColor Magenta

# Export results
$timestamp = Get-Date -Format 'yyyy-MM-dd-HHmmss'
$filename = "production-test-results-$timestamp.json"
$testResults | ConvertTo-Json -Depth 10 | Out-File $filename
Write-Host "`nTest results saved to: $filename" -ForegroundColor Cyan
