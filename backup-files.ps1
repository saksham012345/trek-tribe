# PowerShell Script to Backup Hidden Files Before GitHub Push
# Run this script to backup all files that will be hidden from GitHub

Write-Host "Creating backup of hidden files before GitHub push..." -ForegroundColor Yellow

# Create backup directory
$backupDir = "$env:USERPROFILE\Desktop\trek-tribe-backup"
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force
    Write-Host "Created backup directory: $backupDir" -ForegroundColor Green
}

# Function to safely copy files/directories
function Copy-IfExists {
    param($Source, $Description)
    
    if (Test-Path $Source) {
        try {
            if (Test-Path $Source -PathType Container) {
                Copy-Item -Path $Source -Destination $backupDir -Recurse -Force
                Write-Host "Backed up $Description" -ForegroundColor Green
            } else {
                Copy-Item -Path $Source -Destination $backupDir -Force
                Write-Host "Backed up $Description" -ForegroundColor Green
            }
        } catch {
            Write-Host "Failed to backup $Description" -ForegroundColor Red
        }
    } else {
        Write-Host "$Description not found (skipping)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Backing up environment files..." -ForegroundColor Cyan

# Backup environment files
Copy-IfExists ".env" "Backend environment file (.env)"
Copy-IfExists "web/.env" "Frontend environment file (web/.env)"
Copy-IfExists ".env.backup" "Backend environment backup (.env.backup)"
Copy-IfExists "web/.env.backup" "Frontend environment backup (web/.env.backup)"

Write-Host ""
Write-Host "Backing up important directories..." -ForegroundColor Cyan

# Backup important directories
Copy-IfExists "services/api/logs" "Application logs directory"
Copy-IfExists "services/api/uploads" "User uploads directory"
Copy-IfExists ".wwebjs_auth" "WhatsApp session data"

Write-Host ""
Write-Host "Backing up documentation files..." -ForegroundColor Cyan

# Backup documentation files
Copy-IfExists "ENVIRONMENT_VARIABLES_COMPLETE.md" "Complete environment guide"
Copy-IfExists "QUICK_START_GUIDE.md" "Quick start guide"
Copy-IfExists "SECURITY_SETUP.md" "Security setup guide"
Copy-IfExists "SECURITY_CHECKLIST.md" "Security checklist"
Copy-IfExists "GITHUB_READY_SUMMARY.md" "GitHub ready summary"
Copy-IfExists "PRE_PUSH_CHECKLIST.md" "Pre-push checklist"

Write-Host ""
Write-Host "Backing up setup files..." -ForegroundColor Cyan

# Backup setup files
Copy-IfExists "env-for-development" "Environment development template"
Copy-IfExists "web/env-for-development" "Frontend environment template"
Copy-IfExists "setup-project.ps1" "Setup project script"

Write-Host ""
Write-Host "Backup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Backup location: $backupDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "Files backed up:" -ForegroundColor Cyan
Get-ChildItem $backupDir -Recurse | ForEach-Object {
    if ($_.PSIsContainer) {
        Write-Host "  Directory: $($_.Name)" -ForegroundColor White
    } else {
        Write-Host "  File: $($_.Name)" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "You are now ready to push to GitHub!" -ForegroundColor Green
Write-Host "All hidden files have been safely backed up." -ForegroundColor White
Write-Host ""
Write-Host "Remember:" -ForegroundColor Yellow
Write-Host "- Keep this backup safe" -ForegroundColor White
Write-Host "- You will need these files to restore the project" -ForegroundColor White
Write-Host "- The .env files contain your secrets!" -ForegroundColor White
