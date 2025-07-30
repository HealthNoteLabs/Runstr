@echo off
echo.
echo ===============================================
echo     RUNSTR Level Achievements Calculator
echo ===============================================
echo.
echo Running level achievements calculation...
echo Please wait while we fetch data from Nostr...
echo.

cd /d "%~dp0"
cd scripts

echo Installing dependencies if needed...
call npm install --silent

echo.
echo Calculating level achievements...
node calculate-level-achievements.js

echo.
echo ===============================================
echo Level achievements calculation complete!
echo.
echo Use this data for your weekly newsletter
echo and social media shoutouts!
echo ===============================================
echo.

pause 