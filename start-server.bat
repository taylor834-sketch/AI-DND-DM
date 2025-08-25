@echo off
echo.
echo 🎲 D&D Voice Adventure - Starting Server...
echo.

REM Check if Python is available
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python is not installed or not in PATH
    echo 💡 Please install Python from https://python.org
    echo 💡 Or try: py -m http.server 8000
    pause
    exit /b 1
)

echo ✅ Python found, starting server...
echo.

REM Start the Python server
python start-server.py

pause