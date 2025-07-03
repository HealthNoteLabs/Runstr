@echo off
echo Generating RUNSTR Weekly Social Media Post...
echo.
cd /d %~dp0
node generate-weekly-social-post.mjs
echo.
pause 