# Trek Tribe API Load Testing Script
# Tests the production API at https://trek-tribe-38in.onrender.com

param(
    [int]$Concurrent = 10,
    [int]$Requests = 100,
    [int]$Duration = 60,
    [string]$TestType = "all"
)

$API_URL = "https://trek-tribe-38in.onrender.com"
$timestamp = Get-Date -Format "yyyy-MM-dd-HHmmss"
$resultsFile = "load-test-results-$timestamp.json"

Write-Host "🚀 Trek Tribe API Load Testing" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host "API URL: $API_URL" -ForegroundColor Yellow
Write-Host "Concurrent Users: $Concurrent" -ForegroundColor Yellow
Write-Host "Total Requests: $Requests" -ForegroundColor Yellow
Write-Host "Test Duration: $Duration seconds" -ForegroundColor Yellow
Write-Host ""

# Results storage
$results = @{
    timestamp = $timestamp
    apiUrl = $API_URL
    config = @{
        concurrent = $Concurrent
        requests = $Requests
        duration = $Duration
    }
    tests = @()
    summary = @{
        totalTests = 0
        passed = 0
        failed = 0
        totalRequests = 0
        totalTime = 0
        avgResponseTime = 0
    }
}

# Helper function to make HTTP requests and measure time
function Test-Endpoint {
    param(
        [string]$Method,
        [string]$Path,
        [hashtable]$Headers = @{},
        [object]$Body = $null,
        [int]$Count = 1
    )
    
    $url = "$API_URL$Path"
    $times = @()
    $errors = 0
    $statusCodes = @{}
    
    Write-Host "Testing: $Method $Path ($Count requests)..." -NoNewline
    
    for ($i = 0; $i -lt $Count; $i++) {
        try {
            $sw = [System.Diagnostics.Stopwatch]::StartNew()
            
            $params = @{
                Uri = $url
                Method = $Method
                Headers = $Headers
                TimeoutSec = 30
                ErrorAction = 'Stop'
            }
            
            if ($Body) {
                $params.Body = ($Body | ConvertTo-Json -Depth 10)
                $params.ContentType = 'application/json'
            }
            
            $response = Invoke-WebRequest @params
            $sw.Stop()
            
            $times += $sw.ElapsedMilliseconds
            
            $statusCode = $response.StatusCode
            if ($statusCodes.ContainsKey($statusCode)) {
                $statusCodes[$statusCode]++
            } else {
                $statusCodes[$statusCode] = 1
            }
            
        } catch {
            $sw.Stop()
            $errors++
            $statusCode = if ($_.Exception.Response) { 
                $_.Exception.Response.StatusCode.value__ 
            } else { 
                0 
            }
            
            if ($statusCodes.ContainsKey($statusCode)) {
                $statusCodes[$statusCode]++
            } else {
                $statusCodes[$statusCode] = 1
            }
        }
    }
    
    $avgTime = if ($times.Count -gt 0) { 
        ($times | Measure-Object -Average).Average 
    } else { 
        0 
    }
    
    $minTime = if ($times.Count -gt 0) { 
        ($times | Measure-Object -Minimum).Minimum 
    } else { 
        0 
    }
    
    $maxTime = if ($times.Count -gt 0) { 
        ($times | Measure-Object -Maximum).Maximum 
    } else { 
        0 
    }
    
    $successRate = [math]::Round((($Count - $errors) / $Count) * 100, 2)
    
    if ($errors -eq 0) {
        Write-Host " ✅ $avgTime ms avg" -ForegroundColor Green
    } else {
        Write-Host " ⚠️ $errors errors, $avgTime ms avg" -ForegroundColor Yellow
    }
    
    return @{
        method = $Method
        path = $Path
        count = $Count
        avgTime = [math]::Round($avgTime, 2)
        minTime = $minTime
        maxTime = $maxTime
        errors = $errors
        successRate = $successRate
        statusCodes = $statusCodes
    }
}

# Test 1: Health Check
Write-Host "`n📊 Test 1: Health Check" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan
$healthTest = Test-Endpoint -Method "GET" -Path "/health" -Count 10
$results.tests += $healthTest

# Test 2: Public Endpoints (No Auth)
Write-Host "`n📊 Test 2: Public Endpoints" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan

$publicTests = @(
    @{ Path = "/trips"; Name = "List Trips" },
    @{ Path = "/trips?page=1&limit=10"; Name = "List Trips (Paginated)" },
    @{ Path = "/search/trips?query=trek"; Name = "Search Trips" }
)

foreach ($test in $publicTests) {
    $result = Test-Endpoint -Method "GET" -Path $test.Path -Count 5
    $results.tests += $result
}

# Test 3: Concurrent Load Test
Write-Host "`n📊 Test 3: Concurrent Load Test" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Simulating $Concurrent concurrent users..." -ForegroundColor Yellow

$jobs = @()
$concurrentStart = Get-Date

for ($i = 0; $i -lt $Concurrent; $i++) {
    $job = Start-Job -ScriptBlock {
        param($url)
        $results = @()
        
        for ($j = 0; $j -lt 5; $j++) {
            try {
                $sw = [System.Diagnostics.Stopwatch]::StartNew()
                $response = Invoke-WebRequest -Uri "$url/health" -Method GET -TimeoutSec 30
                $sw.Stop()
                $results += @{
                    success = $true
                    time = $sw.ElapsedMilliseconds
                    status = $response.StatusCode
                }
            } catch {
                $results += @{
                    success = $false
                    time = 0
                    status = 0
                }
            }
        }
        
        return $results
    } -ArgumentList $API_URL
    
    $jobs += $job
}

Write-Host "Waiting for all jobs to complete..." -NoNewline
$jobResults = $jobs | Wait-Job | Receive-Job
$jobs | Remove-Job

$concurrentEnd = Get-Date
$concurrentDuration = ($concurrentEnd - $concurrentStart).TotalSeconds

$successCount = ($jobResults | Where-Object { $_.success }).Count
$totalCount = $jobResults.Count
$avgConcurrentTime = ($jobResults | Where-Object { $_.success } | Measure-Object -Property time -Average).Average

Write-Host " ✅ Done" -ForegroundColor Green
Write-Host "Results: $successCount/$totalCount successful" -ForegroundColor Yellow
Write-Host "Average Response Time: $([math]::Round($avgConcurrentTime, 2)) ms" -ForegroundColor Yellow
Write-Host "Total Duration: $([math]::Round($concurrentDuration, 2)) seconds" -ForegroundColor Yellow

$results.tests += @{
    method = "CONCURRENT"
    path = "/health"
    count = $totalCount
    avgTime = [math]::Round($avgConcurrentTime, 2)
    errors = $totalCount - $successCount
    successRate = [math]::Round(($successCount / $totalCount) * 100, 2)
    duration = [math]::Round($concurrentDuration, 2)
    concurrent = $Concurrent
}

# Test 4: Stress Test (Rapid Fire)
Write-Host "`n📊 Test 4: Stress Test (Rapid Fire)" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host "Sending $Requests requests as fast as possible..." -ForegroundColor Yellow

$stressStart = Get-Date
$stressTimes = @()
$stressErrors = 0

for ($i = 0; $i -lt $Requests; $i++) {
    try {
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $response = Invoke-WebRequest -Uri "$API_URL/health" -Method GET -TimeoutSec 10
        $sw.Stop()
        $stressTimes += $sw.ElapsedMilliseconds
    } catch {
        $stressErrors++
    }
    
    if (($i + 1) % 20 -eq 0) {
        Write-Host "." -NoNewline
    }
}

$stressEnd = Get-Date
$stressDuration = ($stressEnd - $stressStart).TotalSeconds

Write-Host " ✅ Done" -ForegroundColor Green
Write-Host "Results: $($Requests - $stressErrors)/$Requests successful" -ForegroundColor Yellow
Write-Host "Average Response Time: $([math]::Round(($stressTimes | Measure-Object -Average).Average, 2)) ms" -ForegroundColor Yellow
Write-Host "Total Duration: $([math]::Round($stressDuration, 2)) seconds" -ForegroundColor Yellow
Write-Host "Requests/Second: $([math]::Round($Requests / $stressDuration, 2))" -ForegroundColor Yellow

$results.tests += @{
    method = "STRESS"
    path = "/health"
    count = $Requests
    avgTime = [math]::Round(($stressTimes | Measure-Object -Average).Average, 2)
    minTime = ($stressTimes | Measure-Object -Minimum).Minimum
    maxTime = ($stressTimes | Measure-Object -Maximum).Maximum
    errors = $stressErrors
    successRate = [math]::Round((($Requests - $stressErrors) / $Requests) * 100, 2)
    duration = [math]::Round($stressDuration, 2)
    requestsPerSecond = [math]::Round($Requests / $stressDuration, 2)
}

# Test 5: API Endpoint Coverage
Write-Host "`n📊 Test 5: API Endpoint Coverage" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

$endpoints = @(
    @{ Method = "GET"; Path = "/health"; Name = "Health Check" },
    @{ Method = "GET"; Path = "/trips"; Name = "List Trips" },
    @{ Method = "GET"; Path = "/search/trips?query=mountain"; Name = "Search Trips" },
    @{ Method = "GET"; Path = "/events"; Name = "List Events" },
    @{ Method = "GET"; Path = "/groups"; Name = "List Groups" }
)

foreach ($endpoint in $endpoints) {
    $result = Test-Endpoint -Method $endpoint.Method -Path $endpoint.Path -Count 3
    $results.tests += $result
}

# Calculate Summary
Write-Host "`n📈 Summary" -ForegroundColor Cyan
Write-Host "==========" -ForegroundColor Cyan

$results.summary.totalTests = $results.tests.Count
$results.summary.totalRequests = ($results.tests | Measure-Object -Property count -Sum).Sum
$results.summary.passed = ($results.tests | Where-Object { $_.errors -eq 0 }).Count
$results.summary.failed = ($results.tests | Where-Object { $_.errors -gt 0 }).Count
$results.summary.avgResponseTime = [math]::Round(($results.tests | Measure-Object -Property avgTime -Average).Average, 2)

Write-Host "Total Tests: $($results.summary.totalTests)" -ForegroundColor Yellow
Write-Host "Total Requests: $($results.summary.totalRequests)" -ForegroundColor Yellow
Write-Host "Passed: $($results.summary.passed)" -ForegroundColor Green
Write-Host "Failed: $($results.summary.failed)" -ForegroundColor $(if ($results.summary.failed -gt 0) { "Red" } else { "Green" })
Write-Host "Average Response Time: $($results.summary.avgResponseTime) ms" -ForegroundColor Yellow

# Performance Rating
$avgTime = $results.summary.avgResponseTime
$rating = if ($avgTime -lt 100) { "⭐⭐⭐⭐⭐ Excellent" }
          elseif ($avgTime -lt 300) { "⭐⭐⭐⭐ Good" }
          elseif ($avgTime -lt 500) { "⭐⭐⭐ Fair" }
          elseif ($avgTime -lt 1000) { "⭐⭐ Poor" }
          else { "⭐ Very Poor" }

Write-Host "`nPerformance Rating: $rating" -ForegroundColor Cyan

# Save results to JSON
$results | ConvertTo-Json -Depth 10 | Out-File -FilePath $resultsFile -Encoding UTF8
Write-Host "`n💾 Results saved to: $resultsFile" -ForegroundColor Green

# Display detailed results
Write-Host "`n📋 Detailed Results" -ForegroundColor Cyan
Write-Host "===================" -ForegroundColor Cyan

$results.tests | ForEach-Object {
    Write-Host "`n$($_.method) $($_.path)" -ForegroundColor Yellow
    Write-Host "  Requests: $($_.count)" -ForegroundColor Gray
    Write-Host "  Avg Time: $($_.avgTime) ms" -ForegroundColor Gray
    if ($_.minTime) {
        Write-Host "  Min Time: $($_.minTime) ms" -ForegroundColor Gray
        Write-Host "  Max Time: $($_.maxTime) ms" -ForegroundColor Gray
    }
    Write-Host "  Success Rate: $($_.successRate)%" -ForegroundColor $(if ($_.successRate -ge 95) { "Green" } elseif ($_.successRate -ge 80) { "Yellow" } else { "Red" })
    Write-Host "  Errors: $($_.errors)" -ForegroundColor $(if ($_.errors -eq 0) { "Green" } else { "Red" })
}

Write-Host "`n✅ Load testing complete!" -ForegroundColor Green
Write-Host "Results file: $resultsFile" -ForegroundColor Cyan
