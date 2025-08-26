@echo off
echo.
echo Starting Taylor's Epic D^&D Time...
echo.
echo Opening browser to http://localhost:8000
echo.
start http://localhost:8000/index.html
echo.
echo Starting Python server (this window will stay open)...
echo Press Ctrl+C to stop the server when done playing
echo.
cd /d "%~dp0"
python -m http.server 8000
pause