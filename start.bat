@echo off
:: ─────────────────────────────────────────────────────────────────────────────
:: Aperture – Windows bootstrap launcher
:: Double-click start.bat to launch Aperture
:: ─────────────────────────────────────────────────────────────────────────────
echo.
echo   Starting Aperture...
echo.

:: Check if PowerShell is available (it always is on Windows 7+)
where powershell >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo   ERROR: PowerShell is not available on this system.
    echo   Please install PowerShell from: https://aka.ms/pscore6
    pause
    exit /b 1
)

:: Run the PowerShell bootstrap script in the same directory
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"

:: If PowerShell exited with an error, pause so the user can read it
if %ERRORLEVEL% neq 0 (
    echo.
    echo   Something went wrong. See the message above.
    pause
)
