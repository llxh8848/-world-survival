@echo off
cd /d "%~dp0"
title PM2 autostart install

where pm2 >nul 2>nul
if errorlevel 1 (
    echo [ERR] pm2 not found. Run: npm install -g pm2
    pause
    exit /b 1
)

echo [1] start and save server in pm2...
pm2 list | findstr world-server >nul 2>nul
if errorlevel 1 (
    pm2 start server.js --name world-server
)
pm2 save

echo [2] create logon scheduled task...
schtasks /delete /tn "WorldSurvivalServer" /f >nul 2>nul
schtasks /create /tn "WorldSurvivalServer" /tr "cmd /c pm2 resurrect" /sc onlogon /rl highest /f

echo [3] create desktop shortcut...
powershell -NoProfile -Command "$ws=(New-Object -COM WScript.Shell); $lnk=$ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\world-server-bg.lnk'); $lnk.TargetPath='cmd'; $lnk.Arguments='/c pm2 resurrect'; $lnk.WorkingDirectory='%CD%'; $lnk.WindowStyle=7; $lnk.Save()"

pm2 list
echo DONE.
pause
