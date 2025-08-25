@echo off
echo.
echo D^&D Voice Adventure - Simple Server Start
echo ==========================================
echo.

REM Try py command first (most common on Windows)
echo Trying to start server...
py -m http.server 8000 2>nul
if %errorlevel% equ 0 goto :end

REM If py didn't work, try python
python -m http.server 8000 2>nul
if %errorlevel% equ 0 goto :end

REM If python didn't work, try python3
python3 -m http.server 8000 2>nul
if %errorlevel% equ 0 goto :end

REM None worked, show error
echo [ERROR] Could not start Python server
echo.
echo Python might not be installed. Please:
echo 1. Install Python from https://python.org
echo 2. Make sure to check "Add Python to PATH"
echo 3. Restart your computer after installation
echo 4. Try running this file again
echo.
echo Or manually run: py -m http.server 8000
echo Then open: http://localhost:8000

:end
pause