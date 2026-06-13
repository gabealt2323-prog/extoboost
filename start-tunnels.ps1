param(
    [string]$BackendPort = "4000",
    [string]$WebPort = "3000"
)

$cf = "C:\Program Files (x86)\cloudflared\cloudflared.exe"

# Start back-end tunnel
$beLog = "$env:TEMP\cf-be-tunnel.log"
$beProc = Start-Process -FilePath $cf -ArgumentList "tunnel --url http://localhost:$BackendPort" -WindowStyle Normal -PassThru

# Start web tunnel
$weLog = "$env:TEMP\cf-we-tunnel.log"
$weProc = Start-Process -FilePath $cf -ArgumentList "tunnel --url http://localhost:$WebPort" -WindowStyle Normal -PassThru

Write-Host "Tunnels started (PID: backend=$($beProc.Id), web=$($weProc.Id))"
Write-Host "Waiting for URLs..."
Start-Sleep -Seconds 12

# Extract URLs from log files
$beOut = Get-Content $beLog -ErrorAction SilentlyContinue
$weOut = Get-Content $weLog -ErrorAction SilentlyContinue
$bu = ($beOut | Select-String "https://[a-z-]+\.trycloudflare\.com").Matches.Value | Select-Object -First 1
$wu = ($weOut | Select-String "https://[a-z-]+\.trycloudflare\.com").Matches.Value | Select-Object -First 1

Write-Host "BACKEND TUNNEL: $bu"
Write-Host "WEB TUNNEL:     $wu"

# Save to file
@"
BACKEND=$bu
WEB=$wu
"@ | Out-File "$env:TEMP\cf-urls.txt"

Write-Host "URLs saved to $env:TEMP\cf-urls.txt"
Write-Host "`nKeep this window open to maintain tunnels!"
Read-Host "Press Enter to stop tunnels"

$beProc.Kill()
$weProc.Kill()
