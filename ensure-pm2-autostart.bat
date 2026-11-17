@echo off
chcp 65001 >nul
cd /d "F:\xy\xyxnyz"
title 确保 PM2 服务器登录自启

echo ================================================
echo   确保 world-server 通过 PM2 登录自启
echo ================================================
echo.

:: 1. 保存 pm2 当前列表（关键）
echo [1] pm2 save ...
pm2 save
if errorlevel 1 (
    echo   保存失败，尝试启动...
    pm2 start server.js --name world-server
    pm2 save
)

:: 2. 清理旧任务
echo [2] 删除旧任务（如果存在）...
schtasks /delete /tn "WorldSurvivalServer" /f >nul 2>nul

:: 3. 创建新任务：登录时执行本目录的 pm2-resurrect.bat
:: 使用完整路径 + 正确引号
set "TARGET=F:\xy\xyxnyz\pm2-resurrect.bat"
echo [3] 创建计划任务 WorldSurvivalServer ...
echo     目标: "%TARGET%"

schtasks /create /tn "WorldSurvivalServer" /tr "\"%TARGET%\"" /sc onlogon /rl highest /f
set ERR=%errorlevel%

if %ERR%==0 (
    echo [成功] 任务创建/更新完成。
) else (
    echo [失败] 创建返回码 %ERR%
    echo 手动以管理员运行以下命令尝试：
    echo   schtasks /create /tn "WorldSurvivalServer" /tr "\"F:\xy\xyxnyz\pm2-resurrect.bat\"" /sc onlogon /rl highest /f
)

echo.
echo 当前 pm2 进程：
pm2 list

echo.
echo 验证任务：
schtasks /query /tn WorldSurvivalServer /fo LIST

echo.
echo 完成。
echo - 下次登录会自动恢复服务器。
echo - 如需无需登录也运行，请用 NSSM 做 Windows 服务。
echo.
pause
exit /b %ERR%
