@echo off
REM AI Agency OS - lancement Windows : ouvre le dashboard dans le navigateur.
cd /d "%~dp0\.."
if not exist ".venv\Scripts\python.exe" (
  echo Lancez d abord scripts\install.ps1
  pause
  exit /b 1
)
start "" http://127.0.0.1:8000
.venv\Scripts\python.exe -m agency serve
pause
