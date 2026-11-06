# Startup script for Human Fall Detection System
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Starting Human Fall Detection System" -ForegroundColor Cyan
Write-Host "  Backend: FastAPI (Port 8000)" -ForegroundColor Cyan
Write-Host "  Frontend: Next.js (Port 3000)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Start Backend in a new PowerShell window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& { if (Test-Path '.venv\Scripts\Activate.ps1') { .\.venv\Scripts\Activate.ps1 }; python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload }"

# 2. Start Next.js Frontend in a new PowerShell window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& { Set-Location ui; npm run dev }"

Write-Host "`nServices started! Opening browser at http://localhost:3000 ..." -ForegroundColor Green
Start-Sleep -Seconds 2
Start-Process "http://localhost:3000"

