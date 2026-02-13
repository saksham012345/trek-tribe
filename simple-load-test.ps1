# Simple Load Test for Trek Tribe API
$API_URL = "https://trek-tribe-38in.onrender.com"

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Trek Tribe API Load Test" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "API: $API_URL" -ForegroundColor Yellow
Write-Host ""

# Test 1: Single Health Check
Write-Host "[1/5] Health Check..." -NoNewline
try {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $response = Invoke-RestMethod -Uri "$API_URL/health" -Method GET -TimeoutSec 15
    $sw.Stop()
    Write-Host " OK ($($sw.ElapsedMilliseconds)ms)" -ForegroundColor Green
} catch {
    Write-Host " FAILED" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Start-Sleep -Seconds 1

# Test 2: List Trips
Write-Host "[2/5] List Trips..." -NoNewline
try {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $response = Invoke-RestMethod -Uri "$API_URL/trips?page=1&limit=5" -Method GET -TimeoutSec 15
    $sw.Stop()
    Write-Host " OK ($($sw.ElapsedMilliseconds)ms)" -ForegroundColor Green
} catch {
    Write-Host " FAILED" -ForegroundColor Red
}

Start-Sleep -Seconds 1

# Test 3: Search
Write-Host "[3/5] Search Trips..." -NoNewline
try {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $response = Invoke-RestMethod -Uri "$API_URL/search/trips?query=trek" -Method GET -TimeoutSec 15
    $sw.Stop()
    Write-Host " OK ($($sw.ElapsedMilliseconds)ms)" -ForegroundColor Green
} catch {
    Write-Host " FAILED" -ForegroundColor Red
}

Start-Sleep -Seconds 1

# Test 4: Multiple Sequential Requests
Write-Host "[4/5] Sequential Load (10 requests)..." -ForegroundColor Cyan
$times = @()
$errors = 0

for ($i = 1; $i -le 10; $i++) {
    try {
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        Invoke-RestMethod -Uri "$API_URL/health" -Method GET -TimeoutSec 10 | Out-Null
        $sw.Stop()
        $times += $sw.ElapsedMilliseconds
        Write-Host "  Request $i : $($sw.ElapsedMilliseconds)ms" -ForegroundColor Gray
    } catch {
        $errors++
        Write-Host "  Request $i : FAILED" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Sequential Results:" -ForegroundColor Yellow
Write-Host "  Success: $(10 - $errors)/10" -ForegroundColor $(if ($errors -eq 0) { "Green" } else { "Yellow" })

if ($times.Count -gt 0) {
    $avg = [math]::Round(($times | Measure-Object -Average).Average, 2)
    $min = ($times | Measure-Object -Minimum).Minimum
    $max = ($times | Measure-Object -Maximum).Maximum
    
    Write-Host "  Avg: ${avg}ms | Min: ${min}ms | Max: ${max}ms" -ForegroundColor Gray
}

Write-Host ""

# Test 5: Concurrent Requests
Write-Host "[5/5] Concurrent Load (5 parallel requests)..." -ForegroundColor Cyan

$jobs = @()
for ($i = 1; $i -le 5; $i++) {
    $jobs += Start-Job -ScriptBlock {
        param($url)
        try {
            $sw = [System.Diagnostics.Stopwatch]::StartNew()
            Invoke-RestMethod -Uri "$url/health" -Method GET -TimeoutSec 10 | Out-Null
            $sw.Stop()
            return @{ success = $true; time = $sw.ElapsedMilliseconds }
        } catch {
            return @{ success = $false; time = 0 }
        }
    } -ArgumentList $API_URL
}

$results = $jobs | Wait-Job | Receive-Job
$jobs | Remove-Job

$successCount = ($results | Where-Object { $_.success }).Count
$concurrentTimes = ($results | Where-Object { $_.success }).time

Write-Host "Concurrent Results:" -ForegroundColor Yellow
Write-Host "  Success: $successCount/5" -ForegroundColor $(if ($successCount -eq 5) { "Green" } else { "Yellow" })

if ($concurrentTimes.Count -gt 0) {
    $avgConcurrent = [math]::Round(($concurrentTimes | Measure-Object -Average).Average, 2)
    Write-Host "  Avg: ${avgConcurrent}ms" -ForegroundColor Gray
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Load Test Complete!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
