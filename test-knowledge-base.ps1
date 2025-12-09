# Test script for expanded knowledge base

$apiUrl = "http://localhost:4000"

Write-Host "`n=== Testing Expanded Knowledge Base ===" -ForegroundColor Cyan
Write-Host "API URL: $apiUrl`n" -ForegroundColor Gray

# Test queries covering different categories
$testQueries = @(
    @{query="How do I book a trip?"; category="Booking"},
    @{query="What payment methods do you accept?"; category="Payment"},
    @{query="What is your refund policy?"; category="Refund"},
    @{query="Can I get a group discount?"; category="Group Booking"},
    @{query="What should I pack for winter trek?"; category="Packing - Winter"},
    @{query="Packing list for summer trek"; category="Packing - Summer"},
    @{query="Safety tips for solo female travelers"; category="Safety"},
    @{query="How to prevent altitude sickness?"; category="Health"},
    @{query="What to do if I get lost?"; category="Emergency"},
    @{query="Which documents do I need?"; category="Documents"},
    @{query="Do I need permits for trekking?"; category="Permits"},
    @{query="Best season for trekking in Himachal?"; category="Seasons"},
    @{query="Popular treks in Uttarakhand"; category="Destinations"},
    @{query="Tell me about Ladakh treks"; category="Ladakh"},
    @{query="Budget tips for trekking"; category="Budget"},
    @{query="Can I trek with my 10 year old?"; category="Family"},
    @{query="Is travel insurance necessary?"; category="Insurance"},
    @{query="What about toilet facilities on trek?"; category="Hygiene"},
    @{query="Will I get mobile network?"; category="Communication"},
    @{query="What food is provided on treks?"; category="Food"}
)

$successCount = 0
$totalTests = $testQueries.Count

foreach ($test in $testQueries) {
    Write-Host "`nTesting: $($test.category)" -ForegroundColor Yellow
    Write-Host "Query: $($test.query)" -ForegroundColor Gray
    
    try {
        $body = @{ message = $test.query } | ConvertTo-Json
        $response = Invoke-RestMethod -Uri "$apiUrl/api/ai/chat" -Method Post -ContentType "application/json" -Body $body -ErrorAction Stop
        
        if ($response.success -and $response.response) {
            $responseText = $response.response
            $source = if ($response.source) { $response.source } else { "unknown" }
            
            Write-Host "✓ Response received (source: $source)" -ForegroundColor Green
            Write-Host "  Preview: $($responseText.Substring(0, [Math]::Min(100, $responseText.Length)))..." -ForegroundColor Gray
            $successCount++
        } else {
            Write-Host "✗ Invalid response format" -ForegroundColor Red
        }
    } catch {
        Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Start-Sleep -Milliseconds 500
}

Write-Host "`n`n=== Test Summary ===" -ForegroundColor Cyan
Write-Host "Passed: $successCount / $totalTests" -ForegroundColor $(if ($successCount -eq $totalTests) { "Green" } else { "Yellow" })

# Check knowledge base stats
Write-Host "`n=== Knowledge Base Stats ===" -ForegroundColor Cyan
try {
    $status = Invoke-RestMethod -Uri "$apiUrl/api/ai/status" -Method Get
    if ($status.knowledgeBase) {
        Write-Host "Total Documents: $($status.knowledgeBase.totalDocuments)" -ForegroundColor Green
        Write-Host "By Type:" -ForegroundColor Gray
        Write-Host "  - Trips: $($status.knowledgeBase.documentsByType.trip)" -ForegroundColor Gray
        Write-Host "  - Organizers: $($status.knowledgeBase.documentsByType.organizer)" -ForegroundColor Gray
        Write-Host "  - FAQs: $($status.knowledgeBase.documentsByType.faq)" -ForegroundColor Gray
        Write-Host "  - Policies: $($status.knowledgeBase.documentsByType.policy)" -ForegroundColor Gray
        Write-Host "  - General: $($status.knowledgeBase.documentsByType.general)" -ForegroundColor Gray
        Write-Host "Total Embeddings: $($status.knowledgeBase.totalEmbeddings)" -ForegroundColor Green
    }
} catch {
    Write-Host "Could not fetch KB stats: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nTest completed!`n" -ForegroundColor Cyan
