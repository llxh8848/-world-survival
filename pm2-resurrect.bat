@echo off
chcp 65001 >nul
cd /d "F:\xy\xyxnyz"
echo [%date% %time%] Resurrecting pm2 world-server...
where pm2 >nul 2>nul
if errorlevel 1 (
    echo [ERROR] pm2 not found in PATH. Is Node.js global bin in PATH?
    pause
    exit /b 1
)
pm2 resurrect
pm2 list
exit /b 0
