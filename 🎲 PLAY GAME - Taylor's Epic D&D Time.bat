@echo off
setlocal enabledelayedexpansion
title Taylor's Epic D&D Time - v2.0 (Latest)

echo.
echo ==================================================
echo    Taylor's Epic D&D Time - v2.0 (Latest)
echo    With Fog of War Battle System
echo ==================================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH
    echo [TIP] Please install Python from https://python.org
    echo.
    pause
    exit /b 1
)

echo [OK] Python found
echo.

REM Check if port 8000 is already in use
echo [INFO] Checking if port 8000 is available...
netstat -an | findstr :8000 | findstr LISTENING >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Port 8000 is already in use
    echo.
    echo What would you like to do?
    echo 1. Kill existing server and start new one
    echo 2. Open existing server in browser
    echo 3. Exit
    echo.
    set /p choice="Enter your choice (1-3): "
    
    if "!choice!"=="1" goto KillAndRestart
    if "!choice!"=="2" goto OpenExisting
    if "!choice!"=="3" goto ExitScript
    
    REM Default to option 2 if invalid choice
    goto OpenExisting
)

:KillAndRestart
echo [INFO] Stopping existing server...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
    echo [DEBUG] Killing PID: %%a
    taskkill /PID %%a /F
)
timeout /t 3 /nobreak >nul
echo [OK] Previous server stopped
echo.
goto StartServer

:OpenExisting
echo [INFO] Opening existing server in browser...
start http://localhost:8000
echo.
pause
goto ExitScript

:ExitScript
exit /b 0

:StartServer
echo [INFO] Starting server...
echo.

REM Start the enhanced Python server
python "Open Game - Taylors Epic DnD Time.py"

pause
goto ExitScript