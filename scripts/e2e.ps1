<#
PowerShell E2E smoke script for Trek Tribe
Runs a few basic checks against localhost to verify API + AI endpoints are responding.

Usage: From repo root run `pwsh .\scripts\e2e.ps1`
#>

param(
    [string]$ApiUrl = 'http://localhost:4000',
    [string]$WebUrl = 'http://localhost:3000',
    [int]$RetryCount = 10,
    [int]$RetryDelaySec = 2
)

function Retry-Request {
    param($ScriptBlock, $count, $delay)
    for ($i = 1; $i -le $count; $i++) {
        try {
            return & $ScriptBlock
        } catch {
            Write-Host "Attempt $i failed. Retrying in $delay seconds..."
            Start-Sleep -Seconds $delay
        }
    }
    throw "All $count attempts failed"
}

Write-Host "Running E2E smoke checks against $ApiUrl and $WebUrl"

try {
    Write-Host "Checking API health..."
    $health = Retry-Request -ScriptBlock { Invoke-RestMethod -Uri "$ApiUrl/health" -Method Get -TimeoutSec 5 } -count $RetryCount -delay $RetryDelaySec
    Write-Host "API health: $($health | ConvertTo-Json -Depth 2)"
} catch {
    Write-Error "API health check failed: $_"
    exit 2
}

try {
    Write-Host "Checking AI status..."
    $ai = Retry-Request -ScriptBlock { Invoke-RestMethod -Uri "$ApiUrl/api/ai/status" -Method Get -TimeoutSec 5 } -count $RetryCount -delay $RetryDelaySec
    Write-Host "AI status: $($ai | ConvertTo-Json -Depth 2)"
} catch {
    Write-Error "AI status check failed: $_"
    exit 3
}

try {
    Write-Host "Posting sample chat message..."
    $body = @{ message = 'Which places should I visit considering current travel trends and help me book a trip?'; context = @{} } | ConvertTo-Json
    $chat = Retry-Request -ScriptBlock { Invoke-RestMethod -Uri "$ApiUrl/api/ai/chat" -Method Post -Body $body -ContentType 'application/json' -TimeoutSec 10 } -count $RetryCount -delay $RetryDelaySec
    Write-Host "Chat response: $($chat | ConvertTo-Json -Depth 2)"
} catch {
    Write-Error "AI chat check failed: $_"
    exit 4
}

try {
    Write-Host "Fetching public recommendations..."
    $recs = Retry-Request -ScriptBlock { Invoke-RestMethod -Uri "$ApiUrl/api/ai/recommendations" -Method Get -TimeoutSec 10 } -count $RetryCount -delay $RetryDelaySec
    Write-Host "Recommendations: $($recs | ConvertTo-Json -Depth 3)"
} catch {
    Write-Error "Recommendations check failed: $_"
    exit 5
}

Write-Host "Visiting web UI root: $WebUrl"
try {
    $root = Retry-Request -ScriptBlock { Invoke-RestMethod -Uri $WebUrl -Method Get -TimeoutSec 5 } -count $RetryCount -delay $RetryDelaySec
    Write-Host "Web root responded (OK)"
} catch {
    Write-Warning "Web root check failed (UI may be served on a different port). Continuing..."
}

Write-Host "All smoke checks passed."
exit 0
