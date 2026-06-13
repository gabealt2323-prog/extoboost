Write-Host "========================================" -ForegroundColor Cyan
Write-Host "      Extoboost Deployment Script       " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- Step 1: Deploy frontend to Vercel ---
Write-Host "[1/3] Deploying frontend to Vercel..." -ForegroundColor Yellow
Write-Host "      A browser will open. Log in with Google/GitHub." -ForegroundColor Gray
Write-Host ""
$vercelOutput = npx vercel deploy "$PSScriptRoot\web" --prod --name extoboost --yes 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Vercel deploy failed. Trying interactive login..." -ForegroundColor Yellow
    $vercelOutput = npx vercel deploy "$PSScriptRoot\web" --prod --name extoboost 2>&1
}
$vercelUrl = ($vercelOutput | Select-String "https://[a-zA-Z0-9-]+\.vercel\.app" | Select-Object -First 1).Matches.Value
if (-not $vercelUrl) { $vercelUrl = Read-Host "`nPaste the Vercel URL (looks like https://extoboost.vercel.app)" }
Write-Host "Frontend deployed: $vercelUrl" -ForegroundColor Green
Write-Host ""

# --- Step 2: Deploy backend to Railway ---
Write-Host "[2/3] Deploying backend to Railway..." -ForegroundColor Yellow
Write-Host "      A browser will open. Log in with GitHub (free, no credit card)." -ForegroundColor Gray
Write-Host ""

# Create railway.toml for the backend
@"
[build]
  builder = "nixpacks"
  buildCommand = "npm install"

[deploy]
  startCommand = "node server.js"
  healthcheckPath = "/api/v1/health"
  healthcheckTimeout = 100

[service]
  port = 4000
"@ | Out-File "$PSScriptRoot\backend\railway.toml"

Set-Location "$PSScriptRoot\backend"
railway up -y -d
Start-Sleep -Seconds 10

# Get the Railway URL
$railwayUrl = railway domain list 2>&1 | Select-String "\.railway\.app" | ForEach-Object { $_.ToString().Trim().Split(' ')[0] }
if (-not $railwayUrl) {
    $railwayUrl = (railway service list 2>&1 | Select-String "extoboost" | ForEach-Object { $_.ToString().Trim().Split(' ')[-1] })
}
if (-not $railwayUrl) { $railwayUrl = Read-Host "Paste your Railway URL (looks like https://extoboost.up.railway.app)" }
Write-Host "Backend deployed: $railwayUrl" -ForegroundColor Green
Write-Host ""

# --- Step 3: Set environment variables on Railway ---
Write-Host "[3/3] Setting environment variables..." -ForegroundColor Yellow
$envVars = @{
    NODE_ENV = "production"
    WEB_APP_URL = $vercelUrl
    GOOGLE_CALLBACK_URL = "$railwayUrl/api/v1/auth/google/callback"
    JWT_SECRET = [System.Guid]::NewGuid().ToString()
    SESSION_SECRET = [System.Guid]::NewGuid().ToString()
    LINKVERTISE_PUBLISHER_ID = "6478119"
    LOOTLABS_API_KEY = "f697cb00fb90fdd91e0f984e97eb499c49e10324fa0dc48d35d761759e96c4cd"
}
$envVars.GetEnumerator() | ForEach-Object {
    railway variables set "$($_.Key)=$($_.Value)" 2>&1 | Out-Null
}

# Set Google OAuth vars from environment (set these before running)
$googleId = $env:GOOGLE_CLIENT_ID
$googleSecret = $env:GOOGLE_CLIENT_SECRET
if (-not $googleId) { $googleId = Read-Host "Enter GOOGLE_CLIENT_ID" }
if (-not $googleSecret) { $googleSecret = Read-Host "Enter GOOGLE_CLIENT_SECRET" -AsSecureString }
railway variables set "GOOGLE_CLIENT_ID=$googleId" 2>&1 | Out-Null
railway variables set "PORT=4000" 2>&1 | Out-Null

# Redeploy with env vars
railway up -d

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Web App:     $vercelUrl" -ForegroundColor White
Write-Host "Backend API: $railwayUrl" -ForegroundColor White
Write-Host ""

Write-Host "NEXT STEP - Update Google Cloud Console:" -ForegroundColor Yellow
Write-Host "1. Open https://console.cloud.google.com/apis/credentials" -ForegroundColor Gray
Write-Host "2. Edit your OAuth 2.0 Client ID" -ForegroundColor Gray
Write-Host "3. Add this redirect URI:" -ForegroundColor Gray
Write-Host "   $railwayUrl/api/v1/auth/google/callback" -ForegroundColor White
Write-Host ""
Write-Host "Then update Vercel env vars:" -ForegroundColor Yellow
Write-Host "1. Go to https://vercel.com/extoboost/settings/environment-variables" -ForegroundColor Gray
Write-Host "2. Add:" -ForegroundColor Gray
Write-Host "   NEXT_PUBLIC_API_URL = $railwayUrl/api/v1" -ForegroundColor White
Write-Host "   NEXT_PUBLIC_APP_URL = $vercelUrl" -ForegroundColor White
Write-Host "3. Redeploy (Vercel auto-deploys)" -ForegroundColor Gray
Write-Host ""
Write-Host "Press any key to redeploy backend with env vars..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
railway redeploy
Write-Host "Done!" -ForegroundColor Green
