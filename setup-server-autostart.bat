@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 设置服务器开机/后台常驻

echo ==================================================
echo   世界生存服务器 - 设置一直开着
echo   项目目录: %CD%
echo ==================================================
echo.

:: 检查 pm2
where pm2 >nul 2>nul
if errorlevel 1 (
    echo [错误] 未找到 pm2
    echo 请先运行: npm install -g pm2
    pause
    exit /b 1
)

echo [1/3] 保存当前 pm2 进程列表...
pm2 save
if errorlevel 1 (
    echo 保存失败，尝试直接启动...
    pm2 start server.js --name world-server
    pm2 save
)

echo.
echo [2/3] 创建开机自启计划任务（用户登录时启动 pm2 resurrect）...
schtasks /query /tn "WorldSurvivalServer" >nul 2>nul
if %errorlevel%==0 (
    echo 计划任务已存在，正在删除旧的...
    schtasks /delete /tn "WorldSurvivalServer" /f >nul 2>nul
)

:: 使用 pm2 resurrect 让它恢复上次保存的进程
schtasks /create /tn "WorldSurvivalServer" /tr "cmd /c pm2 resurrect" /sc onlogon /rl highest /f
if %errorlevel%==0 (
    echo 计划任务创建成功：WorldSurvivalServer
    echo 将在用户登录时自动恢复服务器。
) else (
    echo 创建计划任务失败，尝试使用 VBS 隐藏启动方式...
)

echo.
echo [3/3] 额外：创建桌面快捷方式用于手动后台启动（隐藏窗口）
set "VBS=%CD%\run-server-hidden.vbs"
if exist "%VBS%" (
    echo 快捷方式目标: %VBS%
    powershell -NoProfile -Command ^
        "$s=(New-Object -COM WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\世界生存-后台服务器.lnk');" ^
        "$s.TargetPath='%VBS%';" ^
        "$s.WorkingDirectory='%CD%';" ^
        "$s.WindowStyle=7;" ^
        "$s.Save()" 2>nul
    if exist "%USERPROFILE%\Desktop\世界生存-后台服务器.lnk" (
        echo 已创建桌面快捷方式：世界生存-后台服务器.lnk
    )
)

echo.
echo ==================================================
echo 当前服务器状态：
pm2 list
echo.
echo 说明：
echo   - 当前会话：pm2 已在后台运行 world-server
echo   - 开机/登录后：计划任务会执行 "pm2 resurrect"
echo   - 如需无需登录就运行（推荐服务器场景），请用 NSSM 注册 Windows 服务
echo.
echo 常用命令：
echo   pm2 list                 查看状态
echo   pm2 logs world-server    查看日志
echo   pm2 restart world-server 重启
echo   pm2 stop world-server    停止
echo.
echo 如要改成 Windows 服务（最彻底）：
echo   1. 下载 nssm: https://nssm.cc/download
echo   2. 解压 nssm.exe 到本目录
echo   3. 以管理员运行 CMD，执行：
echo      cd /d %CD%
echo      nssm install WorldSurvivalServer
echo      Path 填: C:\Program Files\nodejs\node.exe
echo      Startup directory 填: %CD%
echo      Arguments 填: server.js
echo      然后 nssm start WorldSurvivalServer
echo.
pause
