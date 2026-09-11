$ErrorActionPreference = "Stop"

Write-Host "====================================="
Write-Host " BCH - Push to GitHub and Auto Deploy"
Write-Host "====================================="

if (-not (Test-Path ".git")) {
    Write-Host "ERROR: This folder is not a Git repository." -ForegroundColor Red
    exit 1
}

$changes = git status --porcelain

if (-not $changes) {
    Write-Host "No local changes found." -ForegroundColor Yellow
    Write-Host "Checking remote updates..."
    git pull --rebase origin main
    Write-Host "Nothing to commit or push." -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "Changes detected:"
git status --short

Write-Host ""
Write-Host "Adding files..."
git add .

$staged = git diff --cached --name-only

if (-not $staged) {
    Write-Host "Nothing staged for commit." -ForegroundColor Yellow
    exit 0
}

$date = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

Write-Host ""
Write-Host "Creating commit..."
git commit -m "BCH update $date"

Write-Host ""
Write-Host "Syncing with GitHub..."
git pull --rebase origin main

Write-Host ""
Write-Host "Pushing to GitHub..."
git push origin main

Write-Host ""
Write-Host "====================================="
Write-Host "Push completed successfully." -ForegroundColor Green
Write-Host "GitHub Actions will deploy to the VPS automatically."
Write-Host "====================================="
