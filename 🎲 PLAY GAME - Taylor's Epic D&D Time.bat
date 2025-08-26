@echo off
chcp 65001 >nul 2>&1
title Taylor's Epic D&D Time - v2.0 (Latest)

echo.
echo ┌─────────────────────────────────────────────┐
echo │  🎲 Taylor's Epic D&D Time - v2.0 (Latest) │
echo │  ⚡ With Fog of War Battle System            │
echo └─────────────────────────────────────────────┘
echo.

REM Check if Python is available
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH
    echo [TIP] Please install Python from https://python.org
    echo [TIP] Or run: INSTALL-PYTHON.bat
    echo.
    pause
    exit /b 1
)

echo [OK] Python found, starting server...
echo.

REM Start the enhanced Python server
python "Open Game - Taylors Epic DnD Time.py"

pause