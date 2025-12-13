# Quick Webhook Test Commands

# Test 1: Create Razorpay Order
$key = 'rzp_test_RprUwM1vPIM49e'
$secret = 'J0qz5OBw0jzv5LK9GOjdN3cF'
$auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${key}:${secret}"))
$body = @{
    amount = 10000
    currency = "INR"
    receipt = "test_receipt_$(Get-Date -Format 'yyyyMMddHHmmss')"
    payment_capture = 1
    notes = @{
        type = "booking"
        test = "integration_test"
    }
} | ConvertTo-Json

$headers = @{
    'Authorization' = "Basic $auth"
    'Content-Type' = 'application/json'
}

$response = Invoke-RestMethod -Method Post -Uri 'https://api.razorpay.com/v1/orders' -Headers $headers -Body $body
Write-Host "✅ Order Created:" -ForegroundColor Green
$response | ConvertTo-Json -Depth 5

# Test 2: Simulate Webhook (requires API server running)
$webhookSecret = 'WEBHOOK_SECRET'  # Replace with actual secret from dashboard
$webhookPayload = @{
    entity = 'event'
    account_id = 'acc_test'
    event = 'payment.captured'
    contains = @('payment')
    payload = @{
        payment = @{
            entity = @{
                id = "pay_test_$(Get-Date -Format 'yyyyMMddHHmmss')"
                entity = 'payment'
                amount = 10000
                currency = 'INR'
                status = 'captured'
                order_id = $response.id
                method = 'upi'
                captured = $true
                notes = @{
                    type = 'booking'
                    test = 'webhook_test'
                }
            }
        }
    }
    created_at = [int][double]::Parse((Get-Date -UFormat %s))
} | ConvertTo-Json -Depth 10

# Generate webhook signature
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [Text.Encoding]::UTF8.GetBytes($webhookSecret)
$signature = [BitConverter]::ToString($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($webhookPayload))).Replace('-', '').ToLower()

Write-Host "`n📨 Testing Webhook Endpoint..." -ForegroundColor Cyan
Write-Host "Webhook URL: http://localhost:4000/api/webhooks/razorpay"
Write-Host "Signature: $($signature.Substring(0, 20))..."

# Note: Uncomment below when API server is running
# $webhookHeaders = @{
#     'x-razorpay-signature' = $signature
#     'Content-Type' = 'application/json'
# }
# $webhookResponse = Invoke-RestMethod -Method Post -Uri 'http://localhost:4000/api/webhooks/razorpay' -Headers $webhookHeaders -Body $webhookPayload
# Write-Host "`n✅ Webhook Response:" -ForegroundColor Green
# $webhookResponse | ConvertTo-Json

Write-Host "`n⚠️  To test webhook:" -ForegroundColor Yellow
Write-Host "1. Start API server: npm run dev"
Write-Host "2. Get actual webhook secret from Razorpay dashboard"
Write-Host "3. Update RAZORPAY_WEBHOOK_SECRET in .env"
Write-Host "4. Uncomment and run webhook test section above"
