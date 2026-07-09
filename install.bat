@echo off
cd /d "%~dp0"

echo SpicyPrompter Installer
echo ========================
echo.

:: Determine which node to use
set "NODE_EXE="
if exist "%~dp0runtime\node.exe" (
    set "NODE_EXE=%~dp0runtime\node.exe"
    set "PATH=%~dp0runtime;%~dp0runtime\node_modules\.bin;%PATH%"
    echo Portable Node.js found.
    goto :install
)

node --version >nul 2>&1
if not errorlevel 1 (
    set "NODE_EXE=node"
    echo Node.js found:
    node --version
    goto :install
)

:: Download portable Node.js
echo Node.js not found. Downloading portable Node.js LTS...
echo This requires an internet connection.
echo.

set SP_DIR=%~dp0
(
echo $dir = '%SP_DIR%'
echo $url = 'https://nodejs.org/dist/v20.19.3/node-v20.19.3-win-x64.zip'
echo $zip = Join-Path $dir 'runtime.zip'
echo $tmp = Join-Path $dir 'runtime_tmp'
echo $rt  = Join-Path $dir 'runtime'
echo Write-Host 'Downloading...'
echo Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
echo Write-Host 'Extracting...'
echo Expand-Archive -Path $zip -DestinationPath $tmp -Force
echo Move-Item "$tmp\node-v20.19.3-win-x64" $rt
echo Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
echo Remove-Item $zip -Force
echo Write-Host 'Done.'
) > "%temp%\sp_node_install.ps1"

powershell -NoProfile -ExecutionPolicy Bypass -File "%temp%\sp_node_install.ps1"
del "%temp%\sp_node_install.ps1"

if not exist "%~dp0runtime\node.exe" (
    echo.
    echo ERROR: Failed to download Node.js.
    pause
    exit /b 1
)

set "NODE_EXE=%~dp0runtime\node.exe"
set "PATH=%~dp0runtime;%~dp0runtime\node_modules\.bin;%PATH%"

:install
:: Configure port
if exist .env (
    for /f "tokens=2 delims==" %%a in ('findstr /r "^PORT=" .env 2^>nul') do set SP_PORT=%%a
)
if not defined SP_PORT set SP_PORT=3014
set /p SP_PORT=Port to run on [%SP_PORT%]: 
if "%SP_PORT%"=="" set SP_PORT=3014
echo PORT=%SP_PORT%> .env
echo Using port %SP_PORT%.
echo.

echo Installing dependencies ^(this may take a minute^)...
echo.

call npm install --omit=dev
if errorlevel 1 (
    echo.
    echo ERROR: npm install failed.
    pause
    exit /b 1
)

echo.
echo ============================
echo  Installation complete!
echo  Starting SpicyPrompter...
echo  Close this window to stop.
echo ============================
echo.

start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:%SP_PORT%/prompts"

set PORT=%SP_PORT%
"%NODE_EXE%" server.js

echo.
echo Server stopped. Press any key to close.
pause
