@echo off
echo.
echo Python Installation Helper for D^&D Voice Adventure
echo ==================================================
echo.
echo Python is required to run the local server for this app.
echo.
echo OPTION 1: Install from Microsoft Store (Recommended)
echo ------------------------------------------------
echo 1. Press Windows key + S
echo 2. Search for "Python"
echo 3. Install "Python 3.12" from Microsoft Store
echo 4. After installation, run start-server-alternative.bat
echo.
echo OPTION 2: Install from Python.org
echo ---------------------------------
echo 1. Open: https://python.org/downloads
echo 2. Download Python 3.12 or later
echo 3. During installation, CHECK "Add Python to PATH"
echo 4. Restart computer after installation
echo 5. Run start-server-alternative.bat
echo.
echo OPTION 3: Manual Server Start (After Python is installed)
echo ---------------------------------------------------------
echo Open Command Prompt in this folder and run:
echo   py -m http.server 8000
echo Then open: http://localhost:8000 in your browser
echo.
echo OPTION 4: Use Node.js instead
echo -----------------------------
echo If you have Node.js installed:
echo   npx http-server -p 8000
echo.
pause

REM Try to open Microsoft Store Python page
start ms-windows-store://pdp/?productid=9NRWMJP3717K