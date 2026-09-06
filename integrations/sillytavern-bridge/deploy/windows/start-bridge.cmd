@echo off
setlocal

for %%I in ("%~dp0..\..") do set "LF_BRIDGE_ROOT=%%~fI"
set "LF_PYTHON=%LF_BRIDGE_ROOT%\.venv-native\Scripts\python.exe"
set "LF_LOG_DIR=%~dp0logs"
if not defined LF_PORTAL_ST_INTERNAL_URL set "LF_PORTAL_ST_INTERNAL_URL=http://127.0.0.1:8000"
set "LF_PORTAL_ALLOWED_ORIGINS=https://read.adityaarpitha.com,http://localhost:5173,http://127.0.0.1:5173"
set "LF_PORTAL_REQUEST_TIMEOUT_SECONDS=20"
set "LF_PORTAL_MAX_REQUEST_BYTES=4194304"
set "LF_PORTAL_IDEMPOTENCY_TTL_SECONDS=600"
set "LF_PORTAL_IDEMPOTENCY_MAX_ENTRIES=128"
set "LF_PORTAL_CREATION_COOLDOWN_SECONDS=2"

if not exist "%LF_LOG_DIR%" mkdir "%LF_LOG_DIR%"
call :main >>"%LF_LOG_DIR%\bridge.log" 2>&1
set "LF_EXIT_CODE=%ERRORLEVEL%"
echo [%DATE% %TIME%] Portal bridge exited with code %LF_EXIT_CODE%.
exit /b %LF_EXIT_CODE%

:main
echo [%DATE% %TIME%] Starting LexiconForge portal bridge from %LF_BRIDGE_ROOT%.
if not defined LF_PORTAL_VAULT_ROOT (
  echo ERROR: Set LF_PORTAL_VAULT_ROOT in the runtime user's private environment.
  exit /b 2
)
if not defined LF_PORTAL_ST_PUBLIC_URL (
  echo ERROR: Set LF_PORTAL_ST_PUBLIC_URL to the approved SillyTavern HTTPS URL.
  exit /b 2
)
if not defined LF_PORTAL_OWNER_LOGINS (
  echo ERROR: Set LF_PORTAL_OWNER_LOGINS to the authorized owner login.
  exit /b 2
)
if not exist "%LF_BRIDGE_ROOT%\pyproject.toml" (
  echo ERROR: Bridge pyproject.toml is missing from %LF_BRIDGE_ROOT%.
  exit /b 2
)
if not exist "%LF_PYTHON%" (
  echo ERROR: Bridge virtual-environment Python is missing from %LF_PYTHON%. Run bootstrap-bridge.ps1.
  exit /b 2
)
cd /d "%LF_BRIDGE_ROOT%"
"%LF_PYTHON%" -m uvicorn portal_bridge.app:app --host 127.0.0.1 --port 5001 --no-proxy-headers
