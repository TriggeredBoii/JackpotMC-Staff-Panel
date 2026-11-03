$ErrorActionPreference = 'Stop'

Write-Host "JackpotMC Staff Panel - Local Setup" -ForegroundColor Cyan
Write-Host "Your Discord ID is already authorized: 323471274586275840`n"

$ClientId = Read-Host "Discord Application Client ID"
$ClientSecretSecure = Read-Host "Discord Application Client Secret" -AsSecureString
$Ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($ClientSecretSecure)
try { $ClientSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Ptr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Ptr) }

$bytes = New-Object byte[] 48
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$SessionSecret = [Convert]::ToBase64String($bytes)

@"
DISCORD_CLIENT_ID=$ClientId
DISCORD_CLIENT_SECRET=$ClientSecret
DISCORD_REDIRECT_URI=http://localhost:5173/auth/callback
SESSION_SECRET=$SessionSecret
ALLOWED_DISCORD_IDS=323471274586275840
LINKED_DISCORD_IDS=323471274586275840
APP_ENV=development
"@ | Set-Content -Encoding UTF8 .dev.vars

Write-Host "`nCreated .dev.vars and generated the session secret automatically." -ForegroundColor Green
Write-Host "Add this Redirect URI to your Discord application:" -ForegroundColor Yellow
Write-Host "http://localhost:5173/auth/callback" -ForegroundColor White
Write-Host "`nThen run:" -ForegroundColor Yellow
Write-Host "npm install"
Write-Host "npm run dev"
