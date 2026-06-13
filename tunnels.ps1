# Run this in a terminal to start both Cloudflare tunnels
$cf = "C:\Program Files (x86)\cloudflared\cloudflared.exe"

Write-Host "Starting backend tunnel (port 4000)..." -ForegroundColor Cyan
Start-Process -FilePath $cf -ArgumentList "tunnel --url http://localhost:4000" -WindowStyle Normal -PassThru

Write-Host "Starting web tunnel (port 3000)..." -ForegroundColor Cyan
Start-Process -FilePath $cf -ArgumentList "tunnel --url http://localhost:3000" -WindowStyle Normal -PassThru

Write-Host "`nTwo Cloudflare windows should open. Look for the URLs like:" -ForegroundColor Green
Write-Host "  https://XXXX.trycloudflare.com" -ForegroundColor Yellow
Write-Host "`nKeep those windows open — they are your public URLs!" -ForegroundColor Green
