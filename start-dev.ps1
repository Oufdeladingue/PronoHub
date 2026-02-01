# Kill all Node processes
Write-Host "Killing existing Node processes..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Start dev server
Write-Host "Starting Next.js development server..." -ForegroundColor Green
Set-Location "c:\Users\kochr\Projects\PronoHub"
npm run dev
