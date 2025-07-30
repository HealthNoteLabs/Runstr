@echo off
echo.
echo ===============================================
echo     RUNSTR Weekly Rewards Calculator
echo ===============================================
echo.
echo Running weekly rewards calculation...
echo Please wait while we fetch data from Nostr...
echo.

cd /d "%~dp0"
cd scripts

echo Installing dependencies if needed...
call npm install --silent

echo.
echo Calculating weekly rewards...
node calculate-weekly-rewards.js

echo.
echo ===============================================
echo Calculation complete!
echo.
echo Your Friday Workflow:
echo 1. Review the detailed breakdown above
echo 2. Copy the payment list section
echo 3. Process manual payments to each npub
echo 4. Keep this output for records
echo ===============================================
echo.

pause 