$ErrorActionPreference = "Stop"

Write-Host "====================================="
Write-Host " BCH - Push to GitHub and Auto Deploy"
Write-Host "====================================="

function Invoke-GitCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    & git @Arguments

    if ($LASTEXITCODE -ne 0) {
        throw "Git command failed: git $($Arguments -join ' ')"
    }
}

if (-not (Test-Path ".git")) {
    Write-Host "ERROR: This folder is not a Git repository." -ForegroundColor Red
    exit 1
}

$currentBranch = git branch --show-current

if ($LASTEXITCODE -ne 0) {
    throw "Unable to determine the current Git branch."
}

if ($currentBranch -ne "main") {
    Write-Host "ERROR: Current branch is '$currentBranch'. Expected 'main'." -ForegroundColor Red
    exit 1
}

$changes = git status --porcelain

if (-not $changes) {
    Write-Host "No local changes found." -ForegroundColor Yellow
    Write-Host "Checking remote updates..."
    Invoke-GitCommand @("pull", "--rebase", "origin", "main")
    Write-Host "Nothing to commit or push." -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "Changes detected:"
git status --short

Write-Host ""
Write-Host "Adding files..."
Invoke-GitCommand @("add", ".")

$staged = git diff --cached --name-only

if (-not $staged) {
    Write-Host "Nothing staged for commit." -ForegroundColor Yellow
    exit 0
}

$date = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

Write-Host ""
Write-Host "Creating commit..."
Invoke-GitCommand @("commit", "-m", "BCH update $date")

Write-Host ""
Write-Host "Syncing with GitHub..."
Invoke-GitCommand @("pull", "--rebase", "origin", "main")

Write-Host ""
Write-Host "Pushing to GitHub..."
Invoke-GitCommand @("push", "origin", "main")

Write-Host ""
Write-Host "====================================="
Write-Host "Push completed successfully." -ForegroundColor Green
Write-Host "GitHub Actions will deploy to the VPS automatically."
Write-Host "====================================="
