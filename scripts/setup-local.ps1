$ErrorActionPreference = "Stop"

# إعداد PostgreSQL المحلي مرة واحدة دون مس قاعدة الإنتاج.
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$EnvPath = Join-Path $ProjectRoot ".env"
$DatabaseHost = "127.0.0.1"
$DatabasePort = 5000
$DatabaseName = "bch_local"
$DatabaseUser = "bch_local_user"
$envCreated = $false

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

function ConvertTo-DotEnvValue {
    param([Parameter(Mandatory = $true)][string]$Value)

    if ($Value.Contains("`r") -or $Value.Contains("`n")) {
        throw "Environment values cannot contain line breaks."
    }
    return '"' + $Value.Replace('\', '\\').Replace('"', '\"') + '"'
}

function New-RandomHex {
    param([Parameter(Mandatory = $true)][int]$ByteCount)

    $bytes = New-Object byte[] $ByteCount
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $generator.GetBytes($bytes)
        return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $generator.Dispose()
    }
}

function Get-PsqlPath {
    $command = Get-Command psql.exe -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }

    $candidates = Get-ChildItem -LiteralPath "C:\Program Files\PostgreSQL" -Filter psql.exe -Recurse -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending
    if ($candidates) { return $candidates[0].FullName }

    throw "psql.exe was not found. Install PostgreSQL client tools first."
}

if (Test-Path -LiteralPath $EnvPath) {
    Write-Host "Local .env already exists; setup was not changed." -ForegroundColor Yellow
    exit 0
}

$databaseAdmin = "postgres"
$psqlPath = Get-PsqlPath
$databaseAdminPassword = $null
$localPassword = $null
$localPasswordConfirm = $null

try {
    $authenticated = $false
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        $databaseAdminPasswordSecure = Read-Host "PostgreSQL password for '$databaseAdmin' (attempt $attempt/3, input is hidden)" -AsSecureString
        $databaseAdminPassword = ConvertFrom-SecureValue $databaseAdminPasswordSecure
        $env:PGPASSWORD = $databaseAdminPassword

        # لا نجعل رسالة psql الأصلية توقف حلقة المحاولات في Windows PowerShell 5.
        $previousErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            & $psqlPath -h $DatabaseHost -p $DatabasePort -U $databaseAdmin -d postgres -q -tA -c "SELECT 1" 2>$null | Out-Null
            $authenticationExitCode = $LASTEXITCODE
        }
        finally {
            $ErrorActionPreference = $previousErrorActionPreference
        }

        if ($authenticationExitCode -eq 0) {
            $authenticated = $true
            break
        }

        Write-Warning "Incorrect local PostgreSQL username or password. This is the password chosen when PostgreSQL was installed, not the BCH or VPS password."
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
        $databaseAdminPassword = $null
    }

    if (-not $authenticated) {
        throw "Local PostgreSQL rejected three login attempts. Reset the local 'postgres' password, then run this setup again."
    }

    $localUsernameInput = Read-Host "Local platform administrator username [admin]"
    $localUsername = if ([string]::IsNullOrWhiteSpace($localUsernameInput)) { "admin" } else { $localUsernameInput.Trim() }
    if ($localUsername -notmatch '^[A-Za-z0-9._-]{3,50}$') {
        throw "The local username must contain 3-50 letters, numbers, dots, underscores, or hyphens."
    }

    $localAdminNameInput = Read-Host "Local administrator display name [المسؤول العام]"
    $localAdminName = if ([string]::IsNullOrWhiteSpace($localAdminNameInput)) { "المسؤول العام" } else { $localAdminNameInput.Trim() }

    $localPasswordSecure = Read-Host "Local platform administrator password (at least 12 characters)" -AsSecureString
    $localPasswordConfirmSecure = Read-Host "Confirm the local platform password" -AsSecureString
    $localPassword = ConvertFrom-SecureValue $localPasswordSecure
    $localPasswordConfirm = ConvertFrom-SecureValue $localPasswordConfirmSecure

    if ($localPassword.Length -lt 12) { throw "The local platform password must contain at least 12 characters." }
    if ($localPassword -cne $localPasswordConfirm) { throw "The local platform passwords do not match." }

    $databasePassword = New-RandomHex -ByteCount 24
    $setupToken = New-RandomHex -ByteCount 32
    $databaseUrl = "postgresql://${DatabaseUser}:${databasePassword}@${DatabaseHost}:${DatabasePort}/${DatabaseName}?schema=public"

    $roleQueryOutput = @(& $psqlPath -h $DatabaseHost -p $DatabasePort -U $databaseAdmin -d postgres -tA -v ON_ERROR_STOP=1 -c "SELECT 1 FROM pg_roles WHERE rolname = '$DatabaseUser'")
    $roleQueryExitCode = $LASTEXITCODE
    if ($roleQueryExitCode -ne 0) { throw "Could not inspect local PostgreSQL roles." }
    $roleExists = ($roleQueryOutput -join "").Trim()
    if ($roleExists -ne "1") {
        & $psqlPath -h $DatabaseHost -p $DatabasePort -U $databaseAdmin -d postgres -v ON_ERROR_STOP=1 -c "CREATE ROLE $DatabaseUser LOGIN PASSWORD '$databasePassword'" | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Could not create the local database user." }
    }
    else {
        & $psqlPath -h $DatabaseHost -p $DatabasePort -U $databaseAdmin -d postgres -v ON_ERROR_STOP=1 -c "ALTER ROLE $DatabaseUser PASSWORD '$databasePassword'" | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Could not update the local database user." }
    }

    $databaseQueryOutput = @(& $psqlPath -h $DatabaseHost -p $DatabasePort -U $databaseAdmin -d postgres -tA -v ON_ERROR_STOP=1 -c "SELECT 1 FROM pg_database WHERE datname = '$DatabaseName'")
    $databaseQueryExitCode = $LASTEXITCODE
    if ($databaseQueryExitCode -ne 0) { throw "Could not inspect local PostgreSQL databases." }
    $databaseExists = ($databaseQueryOutput -join "").Trim()
    if ($databaseExists -ne "1") {
        & $psqlPath -h $DatabaseHost -p $DatabasePort -U $databaseAdmin -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $DatabaseName OWNER $DatabaseUser" | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Could not create the local database." }
    }
    else {
        & $psqlPath -h $DatabaseHost -p $DatabasePort -U $databaseAdmin -d postgres -v ON_ERROR_STOP=1 -c "ALTER DATABASE $DatabaseName OWNER TO $DatabaseUser" | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Could not assign the local database owner." }
    }

    $envContent = @(
        "# Local development only - generated by scripts/setup-local.ps1"
        "DATABASE_URL=$(ConvertTo-DotEnvValue $databaseUrl)"
        "INITIAL_SETUP_TOKEN=$(ConvertTo-DotEnvValue $setupToken)"
        "INITIAL_ADMIN_USERNAME=$(ConvertTo-DotEnvValue $localUsername)"
        "INITIAL_ADMIN_PASSWORD=$(ConvertTo-DotEnvValue $localPassword)"
        "INITIAL_ADMIN_NAME=$(ConvertTo-DotEnvValue $localAdminName)"
        "ALLOW_DEMO_SEED=false"
    ) -join [Environment]::NewLine
    [IO.File]::WriteAllText($EnvPath, $envContent + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
    $envCreated = $true

    $env:DATABASE_URL = $databaseUrl
    $env:INITIAL_ADMIN_USERNAME = $localUsername
    $env:INITIAL_ADMIN_PASSWORD = $localPassword
    $env:INITIAL_ADMIN_NAME = $localAdminName

    Push-Location $ProjectRoot
    try {
        & (Get-Command npx.cmd -ErrorAction Stop).Source prisma db push
        if ($LASTEXITCODE -ne 0) { throw "Prisma could not prepare the local database." }

        & (Get-Command node.exe -ErrorAction Stop).Source scripts/create-local-admin.cjs
        if ($LASTEXITCODE -ne 0) { throw "Could not create the local platform administrator." }
    }
    finally {
        Pop-Location
    }

    Write-Host "Local BCH database and administrator are ready." -ForegroundColor Green
    Write-Host "Run .\deploy.ps1 to open the platform on localhost." -ForegroundColor Cyan
}
catch {
    if ($envCreated -and (Test-Path -LiteralPath $EnvPath)) {
        Remove-Item -LiteralPath $EnvPath -Force
    }
    throw
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:INITIAL_ADMIN_PASSWORD -ErrorAction SilentlyContinue
    $databaseAdminPassword = $null
    $localPassword = $null
    $localPasswordConfirm = $null
}
