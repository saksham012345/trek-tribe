# Trekk Tribe Development Script
Write-Host "Starting Trekk Tribe development environment..." -ForegroundColor Green

# Check if MongoDB is running (assuming Docker Desktop is available)
Write-Host "Starting MongoDB..." -ForegroundColor Yellow
docker run --rm -d -p 27017:27017 --name trekk-mongo mongo:6

# Wait a moment for MongoDB to start
Start-Sleep -Seconds 5

# Start the API in the background
Write-Host "Starting API server..." -ForegroundColor Yellow
Start-Process -FilePath "powershell" -ArgumentList "-Command", "cd 'services/api'; npm run dev"

# Wait a moment for API to start
Start-Sleep -Seconds 3

# Start the web app
Write-Host "Starting web application..." -ForegroundColor Yellow
Write-Host "Access the application at:" -ForegroundColor Cyan
Write-Host "  Web App: http://localhost:3000" -ForegroundColor Cyan  
Write-Host "  API: http://localhost:4000" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Red

cd web
npm start
