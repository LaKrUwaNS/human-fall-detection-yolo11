@echo off
echo ========================================================
echo   Starting Human Fall Detection System
echo   Backend: FastAPI (Port 8000)
echo   Frontend: Next.js (Port 3000)
echo ========================================================

:: Check if virtualenv exists
if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
) else (
    echo [WARN] .venv not found, using global python environment...
)

:: Start Backend in separate window
echo [INFO] Launching FastAPI Backend on http://localhost:8000 ...
start "Fall Detection - Backend API" cmd /k "python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload"

:: Start Next.js Frontend in separate window
echo [INFO] Launching Next.js UI on http://localhost:3000 ...
start "Fall Detection - Next.js UI" cmd /k "cd ui && npm run dev"

echo ========================================================
echo   Services are starting up!
echo   Open your browser at: http://localhost:3000
echo ========================================================
pause

