# Trekk Tribe Startup Script
Write-Host "Starting Trekk Tribe..." -ForegroundColor Green

# Start API Server
Write-Host "Starting API Server..." -ForegroundColor Yellow
$apiPath = "C:\Users\hp\Desktop\tried\services\api"
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd '$apiPath'; npm run dev"

Start-Sleep -Seconds 5

# Start Web App
Write-Host "Starting Web Application..." -ForegroundColor Yellow
$webPath = "C:\Users\hp\Desktop\tried\web"
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd '$webPath'; npm start"

Write-Host ""
Write-Host "Trekk Tribe is starting up!" -ForegroundColor Green
Write-Host "Web App: http://localhost:3000" -ForegroundColor Cyan
Write-Host "API: http://localhost:4000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Enter to exit this script"
Read-Host
