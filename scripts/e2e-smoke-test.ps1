<#
PowerShell E2E smoke-test for Trek-Tribe API
Usage:
  Open PowerShell and run:
    .\scripts\e2e-smoke-test.ps1 -ApiUrl 'http://localhost:4000' -Email 'tanejasaksham44@gmail.com' -Password 'Agent@9800'

This script will:
  - Log in with provided credentials
  - Create a support ticket
  - Call AI resolve preview for the ticket
  - Confirm resolution for the ticket

Requirements:
  - API server running and reachable at `-ApiUrl`
  - Account exists for the given email/password (preset users are in `services/api/scripts/setup-preset-users-*`)
#>
param(
    [Parameter(Mandatory=$false)] [string]$ApiUrl = "http://localhost:4000",
    [Parameter(Mandatory=$false)] [string]$Email = "tanejasaksham44@gmail.com",
    [Parameter(Mandatory=$false)] [string]$Password = "Agent@9800",
    [Parameter(Mandatory=$false)] [int]$TimeoutSeconds = 30
)

function FailExit($msg, $code = 1) {
    Write-Host "ERROR: $msg" -ForegroundColor Red
    exit $code
}

Write-Host "Running Trek-Tribe E2E smoke test against $ApiUrl"

# Login
try {
    $loginBody = @{ email = $Email; password = $Password } | ConvertTo-Json
    Write-Host "Logging in as $Email..."
    $loginResp = Invoke-RestMethod -Method Post -Uri "$ApiUrl/api/auth/login" -Body $loginBody -ContentType 'application/json' -TimeoutSec $TimeoutSeconds
} catch {
    FailExit "Login failed: $($_.Exception.Message)"
}

$token = $loginResp.token
if (-not $token) {
    FailExit "Login did not return a token. Response: $($loginResp | ConvertTo-Json -Depth 3)"
}
Write-Host "Login successful, token acquired." -ForegroundColor Green

# Create ticket
$ticketBody = @{ subject = 'Smoke test ticket'; message = 'Created by e2e-smoke-test.ps1'; category = 'testing' } | ConvertTo-Json
Write-Host "Creating support ticket..."
try {
    $createResp = Invoke-RestMethod -Method Post -Uri "$ApiUrl/api/support/tickets" -Headers @{ Authorization = "Bearer $token" } -Body $ticketBody -ContentType 'application/json' -TimeoutSec $TimeoutSeconds
} catch {
    FailExit "Create ticket failed: $($_.Exception.Response.Content)`n$($_.Exception.Message)"
}

$ticketId = $createResp._id -or $createResp.id -or $createResp.ticketId
if (-not $ticketId) {
    # Try to inspect response
    Write-Host "Create ticket response:" -ForegroundColor Yellow
    Write-Host ($createResp | ConvertTo-Json -Depth 5)
    FailExit "Could not determine ticket id from create response."
}
Write-Host "Ticket created: $ticketId" -ForegroundColor Green

# Call AI resolve preview
Write-Host "Requesting AI resolution preview..."
try {
    $aiResp = Invoke-RestMethod -Method Post -Uri "$ApiUrl/api/support/tickets/$ticketId/ai-resolve" -Headers @{ Authorization = "Bearer $token" } -ContentType 'application/json' -TimeoutSec $TimeoutSeconds
} catch {
    Write-Host "AI resolve preview request failed: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "Response (if any): $($_.Exception.Response.Content)"
    $aiResp = $null
}

if ($aiResp) {
    Write-Host "AI preview response:" -ForegroundColor Cyan
    Write-Host ($aiResp | ConvertTo-Json -Depth 5)
} else {
    Write-Host "No AI preview response — continuing to confirm resolve for smoke test." -ForegroundColor Yellow
}

# Confirm resolve
Write-Host "Confirming resolve for ticket $ticketId..."
$resolveBody = @{ confirm = $true; message = 'Resolved by smoke test script' } | ConvertTo-Json
try {
    $resolveResp = Invoke-RestMethod -Method Post -Uri "$ApiUrl/api/support/tickets/$ticketId/resolve" -Headers @{ Authorization = "Bearer $token" } -Body $resolveBody -ContentType 'application/json' -TimeoutSec $TimeoutSeconds
} catch {
    FailExit "Confirm resolve failed: $($_.Exception.Message)"
}

Write-Host "Resolve response:" -ForegroundColor Cyan
Write-Host ($resolveResp | ConvertTo-Json -Depth 5)

Write-Host "E2E smoke test completed successfully." -ForegroundColor Green
exit 0
