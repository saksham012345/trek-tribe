# Simple test script for knowledge base

$apiUrl = "http://localhost:4000"

Write-Host "`n=== Testing Knowledge Base ===" -ForegroundColor Cyan
Write-Host "API URL: $apiUrl`n" -ForegroundColor Gray

$tests = @(
    "How do I book a trek?",
    "What payment methods?",
    "Weather in Ladakh July?",
    "Safety for solo female?",
    "Altitude sickness prevention?",
    "Lost on trek what to do?",
    "Documents needed?",
    "Best season for trekking?",
    "Popular treks Uttarakhand?",
    "Budget tips for trekking?"
)

$passed = 0
foreach ($q in $tests) {
    Write-Host "`nQuery: $q" -ForegroundColor Yellow
    try {
        $body = @{ message = $q } | ConvertTo-Json
        $response = Invoke-RestMethod -Uri "$apiUrl/api/ai/chat" -Method Post -ContentType "application/json" -Body $body
        
        if ($response.success) {
            Write-Host "✓ Success" -ForegroundColor Green
            Write-Host "Response: $($response.response.Substring(0, 80))..." -ForegroundColor Gray
            $passed++
        } else {
            Write-Host "✗ Failed" -ForegroundColor Red
        }
    }
    catch {
        Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n=== Results ===" -ForegroundColor Cyan
Write-Host "Passed: $passed / $($tests.Count)" -ForegroundColor Green
