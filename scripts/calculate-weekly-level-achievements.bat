@echo off
echo Running RUNSTR Weekly Level Achievements Calculation...
echo.
cd /d %~dp0
node calculate-weekly-level-achievements.mjs
echo.
pause 