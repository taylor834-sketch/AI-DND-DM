@echo off
echo.
echo D^&D Voice Adventure - Starting Server...
echo ========================================
echo.

REM Try different Python commands
echo Checking for Python installation...

REM Try 'py' first (Windows Python Launcher)
py --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Found Python via 'py' command
    echo Starting server with py -m http.server 8000...
    echo Open your browser to: http://localhost:8000
    echo Press Ctrl+C to stop the server
    echo.
    py -m http.server 8000
    goto :end
)

REM Try 'python' command
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Found Python via 'python' command
    echo Starting server...
    python start-server.py
    goto :end
)

REM Try 'python3' command
python3 --version >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Found Python via 'python3' command
    echo Starting server with python3 -m http.server 8000...
    echo Open your browser to: http://localhost:8000
    echo Press Ctrl+C to stop the server
    echo.
    python3 -m http.server 8000
    goto :end
)

REM No Python found
echo [ERROR] Python is not installed or not in PATH
echo.
echo Please install Python from: https://python.org
echo Make sure to check "Add Python to PATH" during installation
echo.
echo Alternative: Try running one of these commands manually:
echo   py -m http.server 8000
echo   python -m http.server 8000
echo   python3 -m http.server 8000
echo.
echo Then open: http://localhost:8000 in your browser

:end
echo.
pause