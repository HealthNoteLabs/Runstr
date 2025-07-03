@echo off
echo Running NPUB-HEX Converter...
echo.
cd /d %~dp0
node convert-npub-to-hex.mjs
echo.
pause 