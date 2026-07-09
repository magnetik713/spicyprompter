@echo off
echo SpicyPrompter Uninstaller
echo ==========================
echo.
echo This will remove node_modules and the bundled Node.js runtime.
echo Your prompts database will NOT be deleted.
echo.
set /p CONFIRM=Type YES to continue:
if /i not "%CONFIRM%"=="YES" (
    echo Cancelled.
    pause
    exit /b 0
)

echo.
echo Removing dependencies...
if exist "%~dp0node_modules" rmdir /s /q "%~dp0node_modules"

echo Removing bundled runtime...
if exist "%~dp0runtime" rmdir /s /q "%~dp0runtime"

echo.
echo Done. You can now delete this folder to fully remove SpicyPrompter.
echo.
pause
