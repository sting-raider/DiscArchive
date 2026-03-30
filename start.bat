@echo off
setlocal enabledelayedexpansion

echo  Starting DiscArchive — Discord Group DM Search
echo.

echo  Starting Meilisearch...
docker-compose up -d

echo  Setting up backend...
cd backend
if not exist venv (
    echo  Creating Python virtual environment...
    python -m venv venv
)
call venv\Scripts\activate
pip install -r requirements.txt -q
start /b uvicorn main:app --port 8000
cd ..

echo   Setting up frontend...
cd frontend
if not exist node_modules (
    echo  Installing frontend dependencies...
    call pnpm install --silent
)
start /b pnpm dev
cd ..

echo ""
echo    DiscArchive is starting!
echo    Frontend: http://localhost:5173
echo    Backend:  http://localhost:8000
echo    Meili:    http://localhost:7700
echo.
echo    Opening your browser in 5 seconds...
timeout /t 5 >nul
start http://localhost:5173

pause
