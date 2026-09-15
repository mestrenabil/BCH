$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot '.env'
$gmailAddress = 'bchmaroc2030@gmail.com'

Write-Host ''
Write-Host '=====================================' -ForegroundColor Cyan
Write-Host ' BCH - Gmail SMTP configuration'
Write-Host '=====================================' -ForegroundColor Cyan
Write-Host ''
Write-Host "Email account: $gmailAddress"
Write-Host 'Paste the 16-character Google App Password.' -ForegroundColor Yellow
Write-Host 'The input is hidden and will not be printed.' -ForegroundColor DarkGray

$securePassword = Read-Host 'Google App Password' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
    $appPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
}

$appPassword = ($appPassword -replace '\s', '')
if ($appPassword -notmatch '^[A-Za-z0-9]{16}$') {
    throw 'The Google App Password must contain exactly 16 letters or digits.'
}

$settings = [ordered]@{
    SMTP_HOST     = 'smtp.gmail.com'
    SMTP_PORT     = '587'
    SMTP_SECURE   = 'false'
    SMTP_USER     = $gmailAddress
    SMTP_PASSWORD = $appPassword
    SMTP_FROM     = '"منصة قسم الوقاية وحفظ الصحة <bchmaroc2030@gmail.com>"'
}

$lines = [Collections.Generic.List[string]]::new()
if (Test-Path -LiteralPath $envPath) {
    foreach ($existingLine in (Get-Content -LiteralPath $envPath)) {
        $lines.Add([string]$existingLine)
    }
}

foreach ($entry in $settings.GetEnumerator()) {
    $replacement = "$($entry.Key)=$($entry.Value)"
    $foundIndex = -1

    for ($index = 0; $index -lt $lines.Count; $index++) {
        if ($lines[$index] -match "^$([regex]::Escape($entry.Key))=") {
            $foundIndex = $index
            break
        }
    }

    if ($foundIndex -ge 0) {
        $lines[$foundIndex] = $replacement
    }
    else {
        $lines.Add($replacement)
    }
}

$content = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
[IO.File]::WriteAllText($envPath, $content, [Text.UTF8Encoding]::new($false))

$appPassword = $null
$securePassword.Dispose()

Write-Host ''
Write-Host 'Gmail SMTP configuration saved successfully in .env.' -ForegroundColor Green
Write-Host 'Restart the local server so the new settings are loaded.' -ForegroundColor Yellow
