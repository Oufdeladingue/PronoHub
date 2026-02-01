@echo off
echo Killing existing Node processes...
taskkill //F //IM node.exe 2>nul

echo Waiting for ports to be released...
timeout /t 3 /nobreak >nul

echo Starting Next.js development server...
cd /d "%~dp0"
npm run dev
