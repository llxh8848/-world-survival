@echo off
chcp 65001 >nul
cd /d "F:\xy\xyxnyz"
title 创建 PM2 开机自启任务

echo ==============================================
echo   为 PM2 world-server 创建登录自启任务
echo ==============================================
echo.

:: 确保已保存
echo [1] 保存 pm2 当前进程...
pm2 save
if errorlevel 1 (
    echo 保存失败，尝试先启动服务器...
    pm2 start server.js --name world-server
    pm2 save
)

:: 删除旧任务（忽略不存在的错误）
schtasks /delete /tn "WorldSurvivalServer" /f >nul 2>nul

:: 目标：使用本地 pm2-resurrect.bat（带 cd + 诊断）
set "BAT=F:\xy\xyxnyz\pm2-resurrect.bat"

:: 创建任务：登录时以最高权限执行该 bat
schtasks /create /tn "WorldSurvivalServer" /tr "\"%BAT%\"" /sc onlogon /rl highest /f

if %errorlevel%==0 (
    echo.
    echo [成功] 计划任务已创建: WorldSurvivalServer
    echo 每次用户登录时会自动执行 pm2 resurrect 恢复服务器。
) else (
    echo.
    echo [失败] 计划任务创建失败，错误码 %errorlevel%
    echo 手动备用（以管理员CMD运行）：
    echo   schtasks /create /tn "WorldSurvivalServer" /tr "\"F:\xy\xyxnyz\pm2-resurrect.bat\"" /sc onlogon /rl highest /f
)

echo.
echo 当前 pm2 状态:
pm2 list

echo.
echo 提示：
echo - 当前会话：服务器已在 pm2 后台运行
echo - 登录后：WorldSurvivalServer 任务会恢复它
echo - 如需开机无需登录也运行 → 用 NSSM 注册 Windows 服务
echo.
echo 如需立即测试恢复：
echo   pm2 stop world-server
echo   pm2 resurrect
echo.
:: 不 pause，避免计划任务调用时卡住
exit /b %errorlevel%
