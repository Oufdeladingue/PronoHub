@echo off
echo Arret des processus Node.js sur le port 3100...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3100 ^| findstr LISTENING') do (
    echo Killing process %%a
    taskkill /F /PID %%a 2>nul
)
echo.
echo Nettoyage du cache Next.js...
if exist .next rmdir /s /q .next
echo.
echo Demarrage du serveur de developpement...
npm run dev
