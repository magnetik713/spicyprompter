@echo off
echo SpicyPrompter
echo =============
echo Starting server... close this window to stop.
echo.

:: Use portable node if system node not available
where node >nul 2>&1
if errorlevel 1 set "PATH=%~dp0runtime;%~dp0runtime\node_modules\.bin;%PATH%"

:: Read port from .env (default 3014)
for /f "tokens=2 delims==" %%a in ('findstr /r "^PORT=" .env 2^>nul') do set SP_PORT=%%a
if not defined SP_PORT set SP_PORT=3014

:: Open browser after 2s delay without blocking
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:%SP_PORT%/prompts"

:: Run server in foreground — closing window stops it
node server.js

:: If we get here, server exited (error or manual stop)
echo.
echo Server stopped. Press any key to close.
pause
