@echo off
echo.
echo Starting Taylor's Epic D^&D Time...
echo.
echo Opening browser to http://127.0.0.1:8001
echo.
start http://127.0.0.1:8001/index.html
echo.
echo Starting Python server on IPv4 (this window will stay open)...
echo Press Ctrl+C to stop the server when done playing
echo.
cd /d "%~dp0"
python -m http.server 8001 --bind 127.0.0.1
pause