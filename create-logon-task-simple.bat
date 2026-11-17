@echo off
chcp 65001 >nul
cd /d "F:\xy\xyxnyz"

echo ============================================
echo   创建登录时自动恢复服务器的任务
echo ============================================
echo.

:: 1. 保存 pm2 状态（最重要）
echo [1] pm2 save ...
pm2 save
if errorlevel 1 (
    echo   启动 world-server ...
    pm2 start server.js --name world-server
    pm2 save
)

:: 2. 删旧建新
echo [2] 删除旧任务（如果有）...
schtasks /delete /tn WorldSurvivalServer /f >nul 2>nul

echo [3] 创建任务 WorldSurvivalServer ...
echo     触发器: 用户登录时
echo     动作: 运行 F:\xy\xyxnyz\pm2-resurrect.bat

:: 简单路径，无空格问题
schtasks /create /tn WorldSurvivalServer /tr F:\xy\xyxnyz\pm2-resurrect.bat /sc onlogon /rl highest /f

if %errorlevel%==0 (
    echo.
    echo [OK] 任务创建成功！
) else (
    echo.
    echo [FAIL] 创建失败，错误码 %errorlevel%
    echo 请以“管理员身份”打开 CMD，运行:
    echo   cd /d F:\xy\xyxnyz
    echo   schtasks /create /tn WorldSurvivalServer /tr F:\xy\xyxnyz\pm2-resurrect.bat /sc onlogon /rl highest /f
)

echo.
echo 当前 pm2 进程:
pm2 list

echo.
echo 验证任务是否存在:
schtasks /query /tn WorldSurvivalServer /fo LIST

echo.
echo 完成。
echo - 下次登录会自动执行 pm2-resurrect.bat 来恢复服务器。
echo - 如需开机无需登录也运行，请用 NSSM 做 Windows 服务。
echo.
pause
