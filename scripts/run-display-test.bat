@echo off
echo Running Run Display Consistency Test...
echo.
node scripts/test-display-consistency.js
echo.
if %ERRORLEVEL% EQU 0 (
  echo Test PASSED!
) else (
  echo Test FAILED!
)
pause 