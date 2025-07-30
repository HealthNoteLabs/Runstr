@echo off
echo.
echo ===============================================
echo     RUNSTR Weekly Newsletter Generator
echo ===============================================
echo.
echo Generating weekly newsletter...
echo Please wait while we fetch data from Nostr...
echo.

cd /d "%~dp0"
cd scripts

echo Installing dependencies if needed...
call npm install --silent

echo.
echo Generating newsletter...
node generate-newsletter.js

echo.
echo ===============================================
echo Newsletter generation complete!
echo.
echo Check the scripts folder for the saved newsletter file.
echo Copy and paste sections as needed for social media!
echo ===============================================
echo.

pause 