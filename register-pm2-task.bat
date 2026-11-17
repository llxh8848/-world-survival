@echo off
chcp 65001 >nul
cd /d "F:\xy\xyxnyz"

echo ================================================
echo   注册 PM2 登录自启动任务
echo ================================================
echo.

:: 确保 pm2 已保存当前状态
echo [1] pm2 save ...
pm2 save
if errorlevel 1 (
    echo   启动并保存...
    pm2 start server.js --name world-server
    pm2 save
)

:: 删除旧任务
echo [2] 删除旧任务（若存在）...
schtasks /delete /tn "WorldSurvivalServer" /f >nul 2>nul

:: 目标脚本
set "BAT=F:\xy\xyxnyz\pm2-resurrect.bat"

echo [3] 创建任务 WorldSurvivalServer ...
echo     触发: 用户登录
echo     操作: "%BAT%"
echo.

:: 干净的 schtasks 命令（使用 ^" 转义引号）
schtasks /create /tn "WorldSurvivalServer" /tr ^"%BAT%^" /sc onlogon /rl highest /f

if %errorlevel%==0 (
    echo.
    echo [成功] 任务已创建。
) else (
    echo.
    echo [失败] 创建失败，错误码 %errorlevel%
    echo 手动以管理员CMD执行：
    echo   schtasks /create /tn "WorldSurvivalServer" /tr ^"%BAT%^" /sc onlogon /rl highest /f
)

echo.
echo 当前 pm2 状态:
pm2 list

echo.
echo 验证任务:
schtasks /query /tn WorldSurvivalServer /fo LIST 2>nul || echo （无输出表示查询失败，请以管理员运行）

echo.
pause
