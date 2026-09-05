@echo off
setlocal

if not defined LF_ST_ROOT (
  echo ERROR: Set LF_ST_ROOT to the approved SillyTavern installation directory.
  exit /b 2
)
set "LF_LOG_DIR=%~dp0logs"

if not exist "%LF_LOG_DIR%" mkdir "%LF_LOG_DIR%"
call :main >>"%LF_LOG_DIR%\sillytavern.log" 2>&1
set "LF_EXIT_CODE=%ERRORLEVEL%"
echo [%DATE% %TIME%] SillyTavern exited with code %LF_EXIT_CODE%.
exit /b %LF_EXIT_CODE%

:main
echo [%DATE% %TIME%] Starting SillyTavern from %LF_ST_ROOT%.
if not exist "%LF_ST_ROOT%\server.js" (
  echo ERROR: SillyTavern server.js is missing from %LF_ST_ROOT%.
  exit /b 2
)
cd /d "%LF_ST_ROOT%"
node server.js --port 8000 --no-listen --no-browserLaunchEnabled
