@echo off
echo Running RUNSTR User Levels Calculation...
echo.
cd /d %~dp0
node calculate-user-levels.mjs
echo.
pause 