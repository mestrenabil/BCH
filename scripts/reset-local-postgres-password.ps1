$ErrorActionPreference = "Stop"

# إعادة تعيين كلمة مرور PostgreSQL المحلي فقط، مع استرجاع pg_hba.conf دائماً.
$ServiceName = "postgresql-x64-18"
$PostgresRoot = "C:\Program Files\PostgreSQL\18"
$DataDirectory = Join-Path $PostgresRoot "data"
$HbaPath = Join-Path $DataDirectory "pg_hba.conf"
$PsqlPath = Join-Path $PostgresRoot "bin\psql.exe"
$DatabaseHost = "127.0.0.1"
$DatabasePort = 5000
$DatabaseAdmin = "postgres"

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function ConvertFrom-SecureValue {
    param([Parameter(Mandatory = $true)][Security.SecureString]$Value)

    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

if (-not (Test-IsAdministrator)) {
    Write-Host "Requesting Windows administrator permission..." -ForegroundColor Yellow
    $argumentList = "-NoProfile -ExecutionPolicy Bypass -File `"$($MyInvocation.MyCommand.Path)`""
    $elevatedProcess = Start-Process powershell.exe -Verb RunAs -ArgumentList $argumentList -Wait -PassThru
    exit $elevatedProcess.ExitCode
}

$backupPath = "$HbaPath.bch-password-reset-backup"
$configurationChanged = $false
$configurationRestored = $false
$newPassword = $null

try {
    if (-not (Test-Path -LiteralPath $HbaPath)) { throw "PostgreSQL pg_hba.conf was not found." }
    if (-not (Test-Path -LiteralPath $PsqlPath)) { throw "PostgreSQL psql.exe was not found." }
    if (Test-Path -LiteralPath $backupPath) {
        throw "A previous safety backup already exists. Restore or remove it before trying again: $backupPath"
    }

    $newPasswordSecure = Read-Host "New password for local PostgreSQL user 'postgres' (at least 12 characters)" -AsSecureString
    $confirmPasswordSecure = Read-Host "Confirm the new PostgreSQL password" -AsSecureString
    $newPassword = ConvertFrom-SecureValue $newPasswordSecure
    $confirmPassword = ConvertFrom-SecureValue $confirmPasswordSecure

    if ($newPassword.Length -lt 12) { throw "The new password must contain at least 12 characters." }
    if ($newPassword -cne $confirmPassword) { throw "The passwords do not match." }
    if ($newPassword.Contains("`r") -or $newPassword.Contains("`n")) { throw "The password cannot contain line breaks." }

    Copy-Item -LiteralPath $HbaPath -Destination $backupPath -Force
    $originalHba = [IO.File]::ReadAllText($HbaPath)
    $temporaryRules = @(
        "# BCH temporary local password-reset rules"
        "host all postgres 127.0.0.1/32 trust"
        "host all postgres ::1/128 trust"
        ""
    ) -join [Environment]::NewLine
    $configurationChanged = $true
    [IO.File]::WriteAllText($HbaPath, $temporaryRules + $originalHba, [Text.UTF8Encoding]::new($false))

    Restart-Service -Name $ServiceName -Force
    Start-Sleep -Seconds 2

    $escapedPassword = $newPassword.Replace("'", "''")
    $sql = "ALTER ROLE postgres WITH PASSWORD '$escapedPassword';"
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $sql | & $PsqlPath -h $DatabaseHost -p $DatabasePort -U $DatabaseAdmin -d postgres -v ON_ERROR_STOP=1 2>$null | Out-Null
        $alterExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
        $sql = $null
        $escapedPassword = $null
    }
    if ($alterExitCode -ne 0) { throw "PostgreSQL rejected the password change." }
}
catch {
    $resetError = $_
}
finally {
    if ($configurationChanged -and (Test-Path -LiteralPath $backupPath)) {
        try {
            Copy-Item -LiteralPath $backupPath -Destination $HbaPath -Force
            Restart-Service -Name $ServiceName -Force
            Start-Sleep -Seconds 2
            $configurationRestored = $true
            Remove-Item -LiteralPath $backupPath -Force -ErrorAction SilentlyContinue
        }
        catch {
            Write-Host "CRITICAL: Could not restore PostgreSQL authentication. Backup: $backupPath" -ForegroundColor Red
        }
    }
}

try {
    if ($resetError) { throw $resetError }
    if (-not $configurationRestored) { throw "PostgreSQL authentication configuration was not restored." }

    $env:PGPASSWORD = $newPassword
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & $PsqlPath -h $DatabaseHost -p $DatabasePort -U $DatabaseAdmin -d postgres -q -tA -c "SELECT 1" 2>$null | Out-Null
        $verificationExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($verificationExitCode -ne 0) { throw "The new PostgreSQL password could not be verified." }

    Remove-Item -LiteralPath $backupPath -Force -ErrorAction SilentlyContinue
    Write-Host "Local PostgreSQL password was reset and verified successfully." -ForegroundColor Green
    Write-Host "You can now run .\deploy.ps1 and enter the new password." -ForegroundColor Cyan
    Read-Host "Press Enter to close this window" | Out-Null
    exit 0
}
catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    if (Test-Path -LiteralPath $backupPath) {
        Write-Host "The safety backup remains at: $backupPath" -ForegroundColor Yellow
    }
    Read-Host "Press Enter to close this window" | Out-Null
    exit 1
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    $newPassword = $null
    $confirmPassword = $null
}
