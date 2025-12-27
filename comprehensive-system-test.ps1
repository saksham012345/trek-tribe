# TrekTribe Comprehensive System Test
# Tests all major features across backend, frontend, and AI service

$API_URL = "http://localhost:4000"
$FRONTEND_URL = "http://localhost:3000"
$AI_SERVICE_URL = "http://localhost:5000"

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
        
        if ($response.StatusCode -eq $expectedStatus) {
            Write-Host "✅ PASS: $name" -ForegroundColor Green
            $script:passedTests++
            $script:testResults += @{
                Name = $name
                Status = "PASS"
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
Write-TestHeader "1. SYSTEM HEALTH CHECKS"

Test-Endpoint "API Health Check" "$API_URL/health"
Test-Endpoint "AI Service Health" "$AI_SERVICE_URL/health"

# ============================================================================
# 2. AUTHENTICATION TESTS
# ============================================================================
Write-TestHeader "2. AUTHENTICATION & USER MANAGEMENT"

# Register new user
$timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
$testUser = @{
    email = "test.user.$timestamp@trektribe.com"
    password = "TestPass123!"
    name = "Test User $timestamp"
    role = "traveler"
}

$registerResponse = Test-Endpoint "User Registration" "$API_URL/auth/register" -method POST -body $testUser

# Login
if ($registerResponse) {
    $loginResponse = Test-Endpoint "User Login" "$API_URL/auth/login" -method POST -body @{
        email = $testUser.email
        password = $testUser.password
    }
    
    if ($loginResponse) {
        $authData = $loginResponse.Content | ConvertFrom-Json
        $token = $authData.token
        $authHeaders = @{ "Authorization" = "Bearer $token" }
        
        # Test authenticated endpoint
        Test-Endpoint "Get Current User" "$API_URL/auth/me" -headers $authHeaders
    }
}

# Test admin login
$adminLogin = Test-Endpoint "Admin Login" "$API_URL/auth/login" -method POST -body @{
    email = "admin@trektribe.com"
    password = "Admin@123"
}

if ($adminLogin) {
    $adminData = $adminLogin.Content | ConvertFrom-Json
    $adminToken = $adminData.token
    $adminHeaders = @{ "Authorization" = "Bearer $adminToken" }
}

# Test organizer login
$organizerLogin = Test-Endpoint "Organizer Login" "$API_URL/auth/login" -method POST -body @{
    email = "organizer.premium@trektribe.com"
    password = "Organizer@123"
}

if ($organizerLogin) {
    $organizerData = $organizerLogin.Content | ConvertFrom-Json
    $organizerToken = $organizerData.token
    $organizerHeaders = @{ "Authorization" = "Bearer $organizerToken" }
}

# ============================================================================
# 3. TRIP MANAGEMENT
# ============================================================================
Write-TestHeader "3. TRIP MANAGEMENT"

Test-Endpoint "Get All Trips" "$API_URL/trips"
Test-Endpoint "Search Trips" "$API_URL/trips/search?query=trek"

if ($organizerHeaders) {
    # Create trip
    $newTrip = @{
        title = "Test Trek $timestamp"
        description = "Automated test trek"
        destination = "Test Mountains"
        difficulty = "moderate"
        categories = @("Trekking", "Adventure")
        capacity = 20
        price = 2999
        startDate = (Get-Date).AddDays(30).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        endDate = (Get-Date).AddDays(35).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        location = @{
            type = "Point"
            coordinates = @(77.5890, 32.2190)
        }
        schedule = @(
            @{ day = 1; title = "Arrival"; activities = @("Check-in") }
        )
    }
    
    $createTripResponse = Test-Endpoint "Create Trip (Organizer)" "$API_URL/trips" -method POST -body $newTrip -headers $organizerHeaders
    
    if ($createTripResponse) {
        $tripData = $createTripResponse.Content | ConvertFrom-Json
        $tripId = $tripData._id
        
        Test-Endpoint "Get Trip Details" "$API_URL/trips/$tripId"
        Test-Endpoint "Update Trip" "$API_URL/trips/$tripId" -method PUT -body @{ title = "Updated Test Trek" } -headers $organizerHeaders
    }
}

# ============================================================================
# 4. BOOKING SYSTEM
# ============================================================================
Write-TestHeader "4. BOOKING SYSTEM"

if ($authHeaders -and $tripId) {
    $booking = @{
        tripId = $tripId
        numberOfPeople = 2
        paymentMethod = "card"
    }
    
    Test-Endpoint "Create Booking" "$API_URL/bookings" -method POST -body $booking -headers $authHeaders
    Test-Endpoint "Get User Bookings" "$API_URL/bookings/my-bookings" -headers $authHeaders
}

# ============================================================================
# 5. ADMIN ENDPOINTS
# ============================================================================
Write-TestHeader "5. ADMIN FUNCTIONALITY"

if ($adminHeaders) {
    Test-Endpoint "Admin Dashboard Stats" "$API_URL/admin/stats" -headers $adminHeaders
    Test-Endpoint "Get All Users (Admin)" "$API_URL/admin/users" -headers $adminHeaders
    Test-Endpoint "Get All Trips (Admin)" "$API_URL/admin/trips" -headers $adminHeaders
    Test-Endpoint "Verification Requests" "$API_URL/admin/verification-requests" -headers $adminHeaders
}

# ============================================================================
# 6. AI SERVICE TESTS
# ============================================================================
Write-TestHeader "6. AI SERVICE & CHAT WIDGET"

# Test AI generate endpoint
$aiRequest = @{
    prompt = "What are the best trekking destinations in India?"
    max_tokens = 150
}

Test-Endpoint "AI Generate Response" "$AI_SERVICE_URL/generate" -method POST -body $aiRequest

# Test knowledge base query
$kbQuery = @{
    prompt = "Tell me about payment options for trips"
    max_tokens = 200
}

Test-Endpoint "AI Knowledge Base Query" "$AI_SERVICE_URL/generate" -method POST -body $kbQuery

# Test travel recommendation
$travelQuery = @{
    prompt = "Recommend a 5-day trek in Himalayas for beginners"
    max_tokens = 300
}

Test-Endpoint "AI Travel Recommendation" "$AI_SERVICE_URL/generate" -method POST -body $travelQuery

# ============================================================================
# 7. SOCIAL FEATURES
# ============================================================================
Write-TestHeader "7. SOCIAL FEATURES"

if ($authHeaders) {
    Test-Endpoint "Get User Feed" "$API_URL/feed" -headers $authHeaders
    Test-Endpoint "Get Groups" "$API_URL/groups" -headers $authHeaders
    Test-Endpoint "Get Events" "$API_URL/events" -headers $authHeaders
}

# ============================================================================
# 8. PAYMENT & MARKETPLACE
# ============================================================================
Write-TestHeader "8. PAYMENT & MARKETPLACE"

Test-Endpoint "Get Razorpay Config" "$API_URL/config/razorpay"

if ($organizerHeaders) {
    Test-Endpoint "Check Organizer Payout Status" "$API_URL/marketplace/organizer/status" -headers $organizerHeaders
}

# ============================================================================
# 9. ANALYTICS
# ============================================================================
Write-TestHeader "9. ANALYTICS"

if ($authHeaders) {
    Test-Endpoint "Dashboard Analytics" "$API_URL/analytics/dashboard" -headers $authHeaders
}

if ($adminHeaders) {
    Test-Endpoint "User Analytics" "$API_URL/analytics/users" -headers $adminHeaders
    Test-Endpoint "Revenue Analytics" "$API_URL/analytics/revenue" -headers $adminHeaders
}

# ============================================================================
# 10. SUPPORT & TICKETS
# ============================================================================
Write-TestHeader "10. SUPPORT SYSTEM"

if ($authHeaders) {
    $ticket = @{
        subject = "Test Support Ticket $timestamp"
        message = "This is a test ticket"
        category = "general"
        priority = "medium"
    }
    
    Test-Endpoint "Create Support Ticket" "$API_URL/support/tickets" -method POST -body $ticket -headers $authHeaders
    Test-Endpoint "Get My Tickets" "$API_URL/support/tickets/my-tickets" -headers $authHeaders
}

# ============================================================================
# FINAL REPORT
# ============================================================================
Write-Host "`n"
Write-Host "="*80 -ForegroundColor Magenta
Write-Host " TEST SUMMARY" -ForegroundColor Yellow
Write-Host "="*80 -ForegroundColor Magenta
Write-Host ""
Write-Host "Total Tests: $($passedTests + $failedTests)" -ForegroundColor White
Write-Host "Passed: $passedTests" -ForegroundColor Green
Write-Host "Failed: $failedTests" -ForegroundColor Red
Write-Host "Success Rate: $([Math]::Round(($passedTests / ($passedTests + $failedTests)) * 100, 2))%" -ForegroundColor Cyan
Write-Host ""

if ($failedTests -gt 0) {
    Write-Host "Failed Tests:" -ForegroundColor Red
    $testResults | Where-Object { $_.Status -eq "FAIL" } | ForEach-Object {
        Write-Host "  ❌ $($_.Name): $($_.Error)" -ForegroundColor Red
    }
}

Write-Host "`n" -NoNewline
Write-Host "="*80 -ForegroundColor Magenta

# Export results to JSON
$testResults | ConvertTo-Json -Depth 10 | Out-File "test-results-$(Get-Date -Format 'yyyy-MM-dd-HHmmss').json"
Write-Host "`nTest results saved to: test-results-$(Get-Date -Format 'yyyy-MM-dd-HHmmss').json" -ForegroundColor Cyan
