@echo off
REM Lance Chrome avec le remote debugging activé sur le port 9222
REM Utilise un profil dédié pour ne pas interférer avec le Chrome principal

set CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
set DEBUG_PORT=9222
set USER_DATA_DIR=%TEMP%\chrome-debug-profile

echo Lancement de Chrome en mode debug (port %DEBUG_PORT%)...
echo DevTools endpoint: http://localhost:%DEBUG_PORT%
echo.

start "" %CHROME_PATH% ^
  --remote-debugging-port=%DEBUG_PORT% ^
  --user-data-dir="%USER_DATA_DIR%" ^
  --no-first-run ^
  --no-default-browser-check ^
  http://localhost:3100

echo Chrome lance. Tu peux maintenant utiliser Claude avec le MCP Puppeteer.
echo Pour verifier: curl http://localhost:9222/json/version
