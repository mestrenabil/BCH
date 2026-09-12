$ErrorActionPreference = "Stop"
$LocalUrl = "http://localhost:3000"
$LocalHealthUrl = "$LocalUrl/api/health"
$LocalStartupTimeoutSeconds = 120
$ProductionUrl = "https://bch.dabahelp.com"
$DeploymentTimeoutSeconds = 900

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

function Get-CurrentCommit {
    $commit = & git rev-parse HEAD
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to determine the current Git commit."
    }
    return $commit.Trim()
}

function Test-LocalSite {
    try {
        $health = Invoke-RestMethod -Uri $LocalHealthUrl -Method Get -TimeoutSec 5
        return $health.status -eq "ok" -and $health.database -eq "ok"
    }
    catch {
        return $false
    }
}

function Test-LocalHttpServer {
    try {
        Invoke-WebRequest -Uri $LocalUrl -Method Get -UseBasicParsing -TimeoutSec 5 | Out-Null
        return $true
    }
    catch {
        return $null -ne $_.Exception.Response
    }
}

function Stop-StaleLocalPreview {
    $listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1

    if (-not $listener) {
        return $true
    }

    $processes = @()
    $currentProcessId = [int]$listener.OwningProcess

    while ($currentProcessId -gt 0) {
        $process = Get-CimInstance Win32_Process -Filter "ProcessId = $currentProcessId" -ErrorAction SilentlyContinue
        if (-not $process) {
            break
        }

        $processes += $process
        if ($process.CommandLine -match 'npm-cli\.js"?\s+run\s+dev') {
            break
        }

        $currentProcessId = [int]$process.ParentProcessId
    }

    $normalizedProjectPath = $PSScriptRoot.TrimEnd('\')
    $belongsToProject = $processes | Where-Object {
        $_.CommandLine -and $_.CommandLine.IndexOf($normalizedProjectPath, [StringComparison]::OrdinalIgnoreCase) -ge 0
    }

    if (-not $belongsToProject) {
        return $false
    }

    Write-Host "Stopping the stale BCH local server..." -ForegroundColor Yellow
    foreach ($process in $processes) {
        Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
    }

    $deadline = (Get-Date).AddSeconds(10)
    while ((Get-Date) -lt $deadline) {
        if (-not (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)) {
            return $true
        }
        Start-Sleep -Milliseconds 300
    }

    return $false
}

function Start-LocalPreview {
    if (-not (Test-Path -LiteralPath ".env")) {
        Write-Host "Local environment is not configured. Starting the one-time setup..." -ForegroundColor Yellow
        & (Join-Path $PSScriptRoot "scripts\setup-local.ps1")
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath ".env")) {
            throw "Local environment setup did not complete."
        }
    }

    if (-not (Test-LocalSite)) {
        if (Test-LocalHttpServer) {
            if (-not (Stop-StaleLocalPreview)) {
                throw "Port 3000 is used by another application. Stop it or change its port, then run deploy.ps1 again."
            }
        }

        Write-Host ""
        Write-Host "Starting the local preview..." -ForegroundColor Cyan

        $npmCommand = Get-Command npm.cmd -ErrorAction Stop
        $localProcess = Start-Process `
            -FilePath $npmCommand.Source `
            -ArgumentList @("run", "dev") `
            -WorkingDirectory (Get-Location).Path `
            -WindowStyle Hidden `
            -PassThru

        $deadline = (Get-Date).AddSeconds($LocalStartupTimeoutSeconds)
        while ((Get-Date) -lt $deadline) {
            if ($localProcess.HasExited) {
                throw "The local development server stopped before it became ready."
            }
            if (Test-LocalSite) {
                break
            }
            Start-Sleep -Seconds 2
            $localProcess.Refresh()
        }

        if (-not (Test-LocalSite)) {
            throw "The local preview did not start within $LocalStartupTimeoutSeconds seconds."
        }
    }
    else {
        Write-Host "The local preview is already running." -ForegroundColor Green
    }

    Write-Host "Opening $LocalUrl in the default browser..." -ForegroundColor Cyan
    Start-Process "$LocalUrl`?preview=$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
}

function Confirm-ProductionDeployment {
    Write-Host ""
    Write-Host "Review the platform in the browser before continuing." -ForegroundColor Yellow
    $answer = Read-Host "Deploy these changes to production? Type Y to deploy"
    return $answer.Trim().ToUpperInvariant() -eq "Y"
}

function Wait-ForProductionCommit {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ExpectedCommit
    )

    $healthUrl = "$ProductionUrl/api/health"
    $deadline = (Get-Date).AddSeconds($DeploymentTimeoutSeconds)
    $attempt = 0

    Write-Host ""
    Write-Host "Waiting for GitHub Actions to deploy commit $($ExpectedCommit.Substring(0, 7))..." -ForegroundColor Cyan

    while ((Get-Date) -lt $deadline) {
        $attempt++
        try {
            $cacheBuster = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
            $health = Invoke-RestMethod -Uri "$healthUrl`?t=$cacheBuster" -Method Get -TimeoutSec 15
            if ($health.status -eq "ok" -and $health.release -eq $ExpectedCommit) {
                Write-Host "Production is running the expected commit." -ForegroundColor Green
                return $true
            }

            $currentRelease = if ($health.release) { $health.release.ToString().Substring(0, [Math]::Min(7, $health.release.ToString().Length)) } else { "unknown" }
            Write-Host "Attempt ${attempt}: deployment still in progress (server: $currentRelease)."
        }
        catch {
            Write-Host "Attempt ${attempt}: production is not ready yet."
        }

        Start-Sleep -Seconds 10
    }

    Write-Warning "Deployment confirmation timed out. Check GitHub Actions if the new version is not visible."
    return $false
}

function Open-ProductionSite {
    Write-Host "Opening $ProductionUrl in the default browser..." -ForegroundColor Cyan
    Start-Process $ProductionUrl
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
    Start-LocalPreview
    exit 0
}

Write-Host ""
Write-Host "Changes detected:"
git status --short

Start-LocalPreview

if (-not (Confirm-ProductionDeployment)) {
    Write-Host "Deployment cancelled. Your local changes were not committed or pushed." -ForegroundColor Yellow
    exit 0
}

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

$expectedCommit = Get-CurrentCommit
$deploymentReady = Wait-ForProductionCommit -ExpectedCommit $expectedCommit

Write-Host ""
Write-Host "====================================="
Write-Host "Push completed successfully." -ForegroundColor Green
if ($deploymentReady) {
    Write-Host "Deployment completed and verified on the VPS." -ForegroundColor Green
}
else {
    Write-Host "The push succeeded, but deployment was not confirmed before timeout." -ForegroundColor Yellow
}
Write-Host "====================================="

Open-ProductionSite
