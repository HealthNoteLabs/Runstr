@echo off
REM RUNSTR Season Pass Participant Manager - Windows Batch Wrapper
REM This script provides easy access to the participant management tool

cd /d "%~dp0\.."
node scripts/manage-participants.cjs %* 