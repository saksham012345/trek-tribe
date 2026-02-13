# Quick Load Test for Trek Tribe API
$API_URL = "https://trek-tribe-38in.onrender.com"

Write-Host "🚀 Trek Tribe API Quick Load Test" -ForegroundColor Cyan
Write-Host "API: $API_URL" -ForegroundColor Yellow
Write-Host ""

# Test 1: Health Check
Write-Host "Test 1: Health Check..." -NoNewline
try {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $response = Invoke-RestMethod -Uri "$API_URL/health" -Method GET -TimeoutSec 30
    $sw.Stop()
    Write-Host " ✅ $($sw.ElapsedMilliseconds)ms" -ForegroundColor Green
    Write-Host "Response: $($response | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host " ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 2: List Trips
Write-Host "Test 2: List Trips..." -NoNewline
try {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $response = Invoke-RestMethod -Uri "$API_URL/trips?page=1&limit=5" -Method GET -TimeoutSec 30
    $sw.Stop()
    Write-Host " ✅ $($sw.ElapsedMilliseconds)ms" -ForegroundColor Green
    $tripCount = if ($response.trips) { $response.trips.Count } elseif ($response.Count) { $response.Count } else { "Unknown" }
    Write-Host "Found $tripCount trips" -ForegroundColor Gray
} catch {
    Write-Host " ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 3: Search
Write-Host "Test 3: Search Trips..." -NoNewline
try {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $response = Invoke-RestMethod -Uri "$API_URL/search/trips?query=trek" -Method GET -TimeoutSec 30
    $sw.Stop()
    Write-Host " ✅ $($sw.ElapsedMilliseconds)ms" -ForegroundColor Green
} catch {
    Write-Host " ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 4: Multiple Requests
Write-Host "Test 4: Load Test (20 requests)..." -ForegroundColor Cyan
$times = @()
$errors = 0

for ($i = 1; $i -le 20; $i++) {
    try {
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $response = Invoke-RestMethod -Uri "$API_URL/health" -Method GET -TimeoutSec 10
        $sw.Stop()
        $times += $sw.ElapsedMilliseconds
        Write-Host "." -NoNewline
    } catch {
        $errors++
        Write-Host "X" -NoNewline -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Results:" -ForegroundColor Yellow
Write-Host "  Success: $(20 - $errors)/20" -ForegroundColor Green
Write-Host "  Errors: $errors" -ForegroundColor $(if ($errors -gt 0) { "Red" } else { "Green" })

if ($times.Count -gt 0) {
    $avg = ($times | Measure-Object -Average).Average
    $min = ($times | Measure-Object -Minimum).Minimum
    $max = ($times | Measure-Object -Maximum).Maximum
    
    Write-Host "  Avg Time: $([math]::Round($avg, 2))ms" -ForegroundColor Yellow
    Write-Host "  Min Time: $($min)ms" -ForegroundColor Gray
    Write-Host "  Max Time: $($max)ms" -ForegroundColor Gray
}

Write-Host ""
Write-Host "✅ Load test complete!" -ForegroundColor Green
