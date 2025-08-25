@echo off
chcp 65001 >nul 2>&1
echo.
echo D^&D Voice Adventure - Starting Server...
echo.

REM Check if Python is available
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH
    echo [TIP] Please install Python from https://python.org
    echo [TIP] Or try: py -m http.server 8000
    echo.
    pause
    exit /b 1
)

echo [OK] Python found, starting server...
echo.

REM Start the Python server
python start-server.py

pause