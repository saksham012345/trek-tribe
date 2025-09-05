# Trekk Tribe - Complete Application Startup Script
Write-Host "🌲 Starting Trekk Tribe - Forest Adventure Platform 🌲" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green

# Kill any existing node processes
Write-Host "🧹 Cleaning up existing processes..." -ForegroundColor Yellow
try {
    taskkill /F /IM node.exe /T 2>$null
    Start-Sleep -Seconds 2
} catch {
    # Ignore errors if no processes to kill
}

# Check if MongoDB is running
Write-Host "📊 Checking MongoDB connection..." -ForegroundColor Yellow
$mongoRunning = netstat -an | Select-String ":27017"
if (!$mongoRunning) {
    Write-Host "⚠️  MongoDB not detected on port 27017" -ForegroundColor Red
    Write-Host "Starting MongoDB with Docker..." -ForegroundColor Yellow
    try {
        docker run --rm -d -p 27017:27017 --name trekk-mongo mongo:6
        Write-Host "✅ MongoDB container started" -ForegroundColor Green
        Start-Sleep -Seconds 5
    } catch {
        Write-Host "❌ Could not start MongoDB. Please ensure Docker is running." -ForegroundColor Red
        Write-Host "Alternative: Install MongoDB locally or use MongoDB Atlas" -ForegroundColor Cyan
    }
} else {
    Write-Host "✅ MongoDB is already running" -ForegroundColor Green
}

# Start API Server
Write-Host "🚀 Starting API Server..." -ForegroundColor Yellow
$apiPath = "C:\Users\hp\Desktop\tried\services\api"
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd '$apiPath'; Write-Host 'API Server Starting...' -ForegroundColor Green; npm run dev" -WindowStyle Normal

# Wait for API to start
Write-Host "⏳ Waiting for API server to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

# Check if API is running
$apiRunning = $false
for ($i = 1; $i -le 10; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:4000/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $apiRunning = $true
            break
        }
    } catch {}
    Start-Sleep -Seconds 2
    Write-Host "Attempt $i/10 - Checking API..." -ForegroundColor Yellow
}

if ($apiRunning) {
    Write-Host "✅ API Server is running at http://localhost:4000" -ForegroundColor Green
} else {
    Write-Host "⚠️  API Server may still be starting. Check the API window." -ForegroundColor Yellow
}

# Start Web Application  
Write-Host "🌐 Starting Web Application..." -ForegroundColor Yellow
$webPath = "C:\Users\hp\Desktop\tried\web"
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd '$webPath'; Write-Host 'Web App Starting...' -ForegroundColor Green; npm start" -WindowStyle Normal

Write-Host ""
Write-Host "🎉 Trekk Tribe is starting up!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host "🌐 Web Application: http://localhost:3000" -ForegroundColor Cyan
Write-Host "🔌 API Server: http://localhost:4000" -ForegroundColor Cyan  
Write-Host "📊 API Health: http://localhost:4000/health" -ForegroundColor Cyan
Write-Host "🗄️  MongoDB: localhost:27017" -ForegroundColor Cyan
Write-Host ""
Write-Host "🌲 Features Implemented:" -ForegroundColor Green
Write-Host "   ✅ Beautiful Forest-Themed UI" -ForegroundColor White
Write-Host "   ✅ Interactive Landing Page with Sample Trips" -ForegroundColor White
Write-Host "   ✅ User Registration & Authentication" -ForegroundColor White
Write-Host "   ✅ Trip Discovery & Search" -ForegroundColor White
Write-Host "   ✅ Trip Creation (for Organizers)" -ForegroundColor White
Write-Host "   ✅ User Profiles & Management" -ForegroundColor White
Write-Host "   ✅ Responsive Design & Animations" -ForegroundColor White
Write-Host ""
Write-Host "📝 Quick Start Guide:" -ForegroundColor Yellow
Write-Host "   1. Wait for both services to fully load" -ForegroundColor White
Write-Host "   2. Open http://localhost:3000 in your browser" -ForegroundColor White
Write-Host "   3. Register as either a 'Traveler' or 'Organizer'" -ForegroundColor White
Write-Host "   4. Explore sample trips and create your own adventures!" -ForegroundColor White
Write-Host ""
Write-Host "🔧 Troubleshooting:" -ForegroundColor Yellow
Write-Host "   - If registration fails, check API console for errors" -ForegroundColor White
Write-Host "   - Ensure MongoDB is running (port 27017)" -ForegroundColor White
Write-Host "   - Both PowerShell windows should remain open" -ForegroundColor White
Write-Host ""
Write-Host "🎯 To stop: Close both PowerShell windows or press Ctrl+C" -ForegroundColor Red
Write-Host "================================================" -ForegroundColor Green

# Wait and provide status updates
Write-Host "⏳ Waiting for web application to compile..." -ForegroundColor Yellow
Start-Sleep -Seconds 20

# Final check
Write-Host "🔍 Final system check..." -ForegroundColor Yellow
$webRunning = netstat -an | Select-String ":3000"
$apiCheck = netstat -an | Select-String ":4000"

if ($webRunning) {
    Write-Host "✅ Web Application is ready!" -ForegroundColor Green
} else {
    Write-Host "⏳ Web Application still starting..." -ForegroundColor Yellow
}

if ($apiCheck) {
    Write-Host "✅ API Server is ready!" -ForegroundColor Green
} else {
    Write-Host "⏳ API Server still starting..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🌲 Welcome to Trekk Tribe - Your Forest Adventure Awaits! 🌲" -ForegroundColor Green
Write-Host "Visit: http://localhost:3000" -ForegroundColor Cyan -BackgroundColor DarkBlue

# Keep script running
Read-Host "Press Enter to exit this script (servers will continue running)"
