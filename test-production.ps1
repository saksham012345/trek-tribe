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
    Write-Host ""
    Write-Host ("="*80) -ForegroundColor Cyan
    Write-Host " $title" -ForegroundColor Yellow
    Write-Host ("="*80) -ForegroundColor Cyan
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
            Write-Host "PASS: $name" -ForegroundColor Green
            $script:passedTests++
            $script:testResults += @{
                Name = $name
                Status = "PASS"
                StatusCode = $response.StatusCode
            }
            return $response
        } else {
            Write-Host "FAIL: $name (Expected $expectedStatus, got $($response.StatusCode))" -ForegroundColor Red
            $script:failedTests++
            return $null
        }
    } catch {
        Write-Host "FAIL: $name - $($_.Exception.Message)" -ForegroundColor Red
        $script:failedTests++
        $script:testResults += @{
            Name = $name
            Status = "FAIL"
            Error = $_.Exception.Message
        }
        return $null
    }
}

Write-TestHeader "1. PRODUCTION SERVICE HEALTH CHECKS"
Test-Endpoint "API Health Check" "$API_URL/health"
Test-Endpoint "AI Service Health" "$AI_SERVICE_URL/health"

Write-TestHeader "2. AI SERVICE - KNOWLEDGE BASE & RECOMMENDATIONS"

$aiRequest1 = @{ prompt = "What are the best trekking destinations in India?"; max_tokens = 150 }
Test-Endpoint "AI General Knowledge" "$AI_SERVICE_URL/generate" -method POST -body $aiRequest1

$aiRequest2 = @{ prompt = "Tell me about payment options for trips on TrekTribe"; max_tokens = 200 }
Test-Endpoint "AI Payment Knowledge Base" "$AI_SERVICE_URL/generate" -method POST -body $aiRequest2

$aiRequest3 = @{ prompt = "How do I book a trek on TrekTribe?"; max_tokens = 200 }
Test-Endpoint "AI Booking Knowledge Base" "$AI_SERVICE_URL/generate" -method POST -body $aiRequest3

$aiRequest4 = @{ prompt = "What documents do I need to upload for ID verification?"; max_tokens = 200 }
Test-Endpoint "AI ID Verification Knowledge" "$AI_SERVICE_URL/generate" -method POST -body $aiRequest4

$aiRequest5 = @{ prompt = "Recommend a 5-day trek in Himalayas for beginners"; max_tokens = 300 }
Test-Endpoint "AI Trek Recommendation" "$AI_SERVICE_URL/generate" -method POST -body $aiRequest5

Write-TestHeader "3. AUTHENTICATION & USER MANAGEMENT"

$organizerLogin = Test-Endpoint "Organizer Login" "$API_URL/auth/login" -method POST -body @{
    email = "organizer.premium@trektribe.com"
    password = "Organizer@123"
}

Write-TestHeader "4. TRIP MANAGEMENT & DISCOVERY"
Test-Endpoint "Get All Trips" "$API_URL/trips"

Write-TestHeader "PRODUCTION TEST SUMMARY"
Write-Host ""
Write-Host "Tested Against:" -ForegroundColor Cyan
Write-Host "  Backend: $API_URL"
Write-Host "  Frontend: $FRONTEND_URL"
Write-Host "  AI Service: $AI_SERVICE_URL"
Write-Host ""
Write-Host "Total Tests: $($passedTests + $failedTests)"
Write-Host "Passed: $passedTests" -ForegroundColor Green
Write-Host "Failed: $failedTests" -ForegroundColor Red
Write-Host ""

Write-Host ("="*80) -ForegroundColor Red
Write-Host " CRITICAL ISSUES FOUND" -ForegroundColor Yellow
Write-Host ("="*80) -ForegroundColor Red
Write-Host ""
Write-Host "1. ID VERIFICATION UPLOAD MISSING" -ForegroundColor Red
Write-Host "   Join trip requires ID verification but no upload UI exists"
Write-Host "   Backend service exists: services/api/src/services/idVerificationService.ts" -ForegroundColor Cyan
Write-Host "   Solution: Create ID upload component in JoinTripModal.tsx" -ForegroundColor Yellow
Write-Host ""
Write-Host "2. FIREBASE CREDENTIALS MISSING FROM ENV EXAMPLES" -ForegroundColor Red
Write-Host "   Firebase is used but credentials not in .env.example"
Write-Host "   Firebase used in: services/api/src/services/firebaseService.ts" -ForegroundColor Cyan
Write-Host "   Solution: Add Firebase env vars to env.example files" -ForegroundColor Yellow
Write-Host ""

$timestamp = Get-Date -Format 'yyyy-MM-dd-HHmmss'
$filename = "production-test-results-$timestamp.json"
$testResults | ConvertTo-Json -Depth 10 | Out-File $filename
Write-Host "Test results saved to: $filename" -ForegroundColor Cyan
