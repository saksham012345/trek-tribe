# Firebase Setup Helper for Trek Tribe
# Run this script after getting Firebase credentials

Write-Host "🔥 Firebase Setup for Trek Tribe" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# Check if .env file exists
if (-not (Test-Path "services/api/.env")) {
    Write-Host "❌ .env file not found in services/api/" -ForegroundColor Red
    Write-Host "Please make sure you're running this from the trek-tribe root directory" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n📋 Firebase Console Steps:" -ForegroundColor Yellow
Write-Host "1. Go to https://console.firebase.google.com/" -ForegroundColor White
Write-Host "2. Create a new project (or select existing)" -ForegroundColor White
Write-Host "3. Enable Storage (left sidebar > Storage > Get started)" -ForegroundColor White
Write-Host "4. Get your config (Project Settings > General > Your apps > Web app)" -ForegroundColor White

Write-Host "`n🔑 Please enter your Firebase configuration:" -ForegroundColor Green

# Get Firebase configuration from user
$apiKey = Read-Host "Firebase API Key"
$authDomain = Read-Host "Auth Domain (project-id.firebaseapp.com)"
$projectId = Read-Host "Project ID"
$storageBucket = Read-Host "Storage Bucket (project-id.appspot.com)"
$messagingSenderId = Read-Host "Messaging Sender ID"
$appId = Read-Host "App ID"

# Validate inputs
if (-not $apiKey -or -not $projectId -or -not $storageBucket) {
    Write-Host "❌ Missing required fields. API Key, Project ID, and Storage Bucket are required." -ForegroundColor Red
    exit 1
}

Write-Host "`n⚙️ Updating .env file..." -ForegroundColor Yellow

# Read current .env file
$envContent = Get-Content "services/api/.env" -Raw

# Replace Firebase placeholder values
$envContent = $envContent -replace "FIREBASE_API_KEY=your_firebase_api_key_here", "FIREBASE_API_KEY=$apiKey"
$envContent = $envContent -replace "FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com", "FIREBASE_AUTH_DOMAIN=$authDomain"
$envContent = $envContent -replace "FIREBASE_PROJECT_ID=your_project_id", "FIREBASE_PROJECT_ID=$projectId"
$envContent = $envContent -replace "FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com", "FIREBASE_STORAGE_BUCKET=$storageBucket"
$envContent = $envContent -replace "FIREBASE_MESSAGING_SENDER_ID=123456789012", "FIREBASE_MESSAGING_SENDER_ID=$messagingSenderId"
$envContent = $envContent -replace "FIREBASE_APP_ID=1:123456789012:web:abcdefghijklmnop", "FIREBASE_APP_ID=$appId"

# Write back to .env file
Set-Content "services/api/.env" -Value $envContent

Write-Host "✅ Firebase configuration updated in .env file!" -ForegroundColor Green

Write-Host "`n🧪 Testing Firebase connection..." -ForegroundColor Yellow

# Test the connection by starting the API briefly
$testProcess = Start-Process -FilePath "npm" -ArgumentList "run", "dev:api" -WorkingDirectory "services/api" -NoNewWindow -PassThru

Start-Sleep -Seconds 5

# Check if Firebase initialized successfully in logs
Write-Host "⏳ Check the server logs for 'Firebase Service initialized successfully'" -ForegroundColor Cyan

# Stop the test process
Stop-Process -Id $testProcess.Id -Force -ErrorAction SilentlyContinue

Write-Host "`n🎉 Firebase Setup Complete!" -ForegroundColor Green
Write-Host "🔥 Your Trek Tribe app now has Firebase backup for files!" -ForegroundColor Green

Write-Host "`n📝 Next steps:" -ForegroundColor Yellow
Write-Host "1. Start your API server: npm run dev:api" -ForegroundColor White
Write-Host "2. Upload a file to test the Firebase backup" -ForegroundColor White
Write-Host "3. Check Firebase Console > Storage to see uploaded files" -ForegroundColor White

Write-Host "`n🔒 Security Note:" -ForegroundColor Cyan
Write-Host "Firebase is configured in test mode. For production, update security rules." -ForegroundColor White