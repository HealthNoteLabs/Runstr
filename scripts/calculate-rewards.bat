@echo off
echo Running RUNSTR Weekly Rewards Calculation...
echo.
cd /d %~dp0
node calculate-weekly-rewards.mjs
echo.
pause 