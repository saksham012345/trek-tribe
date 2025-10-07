# Trekk Tribe Project Setup Script
# This script sets up the environment files for easy development

Write-Host "🚀 Setting up Trekk Tribe for development..." -ForegroundColor Green

# Check if env files already exist
if (Test-Path ".env") {
    Write-Host "⚠️ .env file already exists. Backing up to .env.backup" -ForegroundColor Yellow
    Copy-Item ".env" ".env.backup"
}

if (Test-Path "web/.env") {
    Write-Host "⚠️ web/.env file already exists. Backing up to web/.env.backup" -ForegroundColor Yellow
    Copy-Item "web/.env" "web/.env.backup"
}

# Setup backend environment
if (Test-Path "env-for-development") {
    Copy-Item "env-for-development" ".env"
    Write-Host "✅ Backend environment file created (.env)" -ForegroundColor Green
} else {
    Write-Host "❌ env-for-development file not found!" -ForegroundColor Red
    exit 1
}

# Setup frontend environment
if (Test-Path "web/env-for-development") {
    Copy-Item "web/env-for-development" "web/.env"
    Write-Host "✅ Frontend environment file created (web/.env)" -ForegroundColor Green
} else {
    Write-Host "❌ web/env-for-development file not found!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🎉 Setup complete! Your environment files are ready." -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "  1. Start MongoDB: docker run -d -p 27017:27017 --name trekk-mongo mongo:6" -ForegroundColor White
Write-Host "  2. Install dependencies: npm run install:all" -ForegroundColor White
Write-Host "  3. Start backend: npm run dev:api" -ForegroundColor White
Write-Host "  4. Start frontend: npm run dev:web" -ForegroundColor White
Write-Host ""
Write-Host "🌐 Access your app at:" -ForegroundColor Cyan
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "  Backend:  http://localhost:4000" -ForegroundColor White
Write-Host ""
Write-Host "📚 For more help, see QUICK_START_GUIDE.md" -ForegroundColor Yellow
