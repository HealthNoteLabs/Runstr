@echo off
echo.
echo ===============================================
echo     RUNSTR FRIDAY WORKFLOW - Complete Package
echo ===============================================
echo.
echo This will run all three scripts in sequence:
echo 1. Weekly Rewards Calculator
echo 2. Level Achievements Calculator  
echo 3. Newsletter Generator
echo.
echo Please wait while we fetch data from Nostr...
echo.

cd /d "%~dp0"
cd scripts

echo Installing dependencies if needed...
call npm install --silent

echo.
echo ===============================================
echo [1/3] CALCULATING WEEKLY REWARDS
echo ===============================================
echo.
node calculate-weekly-rewards.js

echo.
echo ===============================================
echo [2/3] CALCULATING LEVEL ACHIEVEMENTS
echo ===============================================
echo.
node calculate-level-achievements.js

echo.
echo ===============================================
echo [3/3] GENERATING NEWSLETTER
echo ===============================================
echo.
node generate-newsletter.js

echo.
echo ===============================================
echo FRIDAY WORKFLOW COMPLETE!
echo ===============================================
echo.
echo Your outputs are ready:
echo 1. Weekly rewards calculation (above)
echo 2. Level achievements data (above)
echo 3. Newsletter file saved in scripts folder
echo.
echo Next steps:
echo 1. Copy payment list and process zaps
echo 2. Post level achievements on social media
echo 3. Use newsletter content for weekly update
echo ===============================================
echo.

pause 