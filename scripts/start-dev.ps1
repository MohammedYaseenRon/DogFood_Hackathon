# Start backend and frontend for local development
$root = Split-Path -Parent $PSScriptRoot

Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "cd '$root\backend'; python -m uvicorn app.main:app --reload --port 4000"
)

Start-Sleep -Seconds 2

Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "cd '$root\frontend'; npm run dev"
)

Write-Host "Backend: http://localhost:4000"
Write-Host "Frontend: http://localhost:8080"
