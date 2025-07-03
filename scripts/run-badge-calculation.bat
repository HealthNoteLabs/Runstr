@echo off
:: RUNSTR Weekly Badge Calculation Helper Script
:: Windows Batch File

echo.
echo ========================================
echo    RUNSTR Weekly Badge Calculator
echo ========================================
echo.

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%\.."

:: Check command line arguments
if "%1"=="--dry-run" (
    echo Running in DRY RUN mode - no data will be saved
    echo.
    node scripts/calculate-weekly-badges.mjs --dry-run
) else if "%1"=="--catchup" (
    echo Running RETROACTIVE CATCHUP - awarding all existing users their badges!
    echo Press Ctrl+C to cancel within 10 seconds...
    timeout /t 10 /nobreak >nul
    echo.
    node scripts/calculate-weekly-badges.mjs --catchup
) else if "%1"=="--catchup-dry" (
    echo Running CATCHUP DRY RUN - preview existing users who need badges
    echo.
    node scripts/calculate-weekly-badges.mjs --catchup --dry-run
) else if "%1"=="--help" (
    echo Usage:
    echo   run-badge-calculation.bat              - Run weekly badge calculation
    echo   run-badge-calculation.bat --dry-run    - Preview weekly changes only
    echo   run-badge-calculation.bat --catchup    - Award ALL existing users their badges
    echo   run-badge-calculation.bat --catchup-dry - Preview catchup awards only
    echo   run-badge-calculation.bat --help       - Show this help
    echo.
    echo Output files:
    echo   scripts/badge-tracking.json            - User progress tracking
    echo   scripts/badge-recipients-YYYY-MM-DD.json - Weekly badge recipients
    echo   scripts/badge-catchup-YYYY-MM-DD.json - Catchup badge recipients
    echo.
    pause
    exit /b 0
) else (
    echo Running FULL weekly badge calculation - data will be updated
    echo Press Ctrl+C to cancel within 5 seconds...
    timeout /t 5 /nobreak >nul
    echo.
    node scripts/calculate-weekly-badges.mjs
)

echo.
echo Script completed. Check output above for results.
echo.
pause