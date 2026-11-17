@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "F:\xy\xyxnyz"
title 安装 PM2 登录自启动任务 (WorldSurvivalServer)

echo =====================================================
echo   世界生存服务器 - PM2 登录自启动设置
echo   项目目录: %CD%
echo =====================================================
echo.

:: 1. 保存 pm2 状态
echo [1/3] 保存当前 pm2 进程...
pm2 save
if errorlevel 1 (
    echo   pm2 save 失败，尝试启动服务器...
    pm2 start server.js --name world-server
    pm2 save
)

:: 2. 删除旧任务（如果存在）
echo [2/3] 清理旧任务...
schtasks /delete /tn "WorldSurvivalServer" /f >nul 2>nul

:: 3. 使用 PowerShell 可靠地创建计划任务
echo [3/3] 创建计划任务 "WorldSurvivalServer"（用户登录时运行）...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$taskName='WorldSurvivalServer';" ^
  "$bat='F:\xy\xyxnyz\pm2-resurrect.bat';" ^
  "schtasks /delete /tn $taskName /f 2>$null | Out-Null;" ^
  "$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c \"' + $bat + '\"' -WorkingDirectory 'F:\xy\xyxnyz';" ^
  "$trigger = New-ScheduledTaskTrigger -AtLogOn;" ^
  "$principal = New-ScheduledTaskPrincipal -UserId \"$env:USERDOMAIN\$env:USERNAME\" -RunLevel Highest;" ^
  "$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable;" ^
  "Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null;" ^
  "Write-Host '任务创建成功:' $taskName;"

if %errorlevel%==0 (
    echo [成功] 计划任务已创建/更新。
) else (
    echo [备用] PowerShell 方式返回码非0，尝试 schtasks 直接方式...
    schtasks /create /tn "WorldSurvivalServer" /tr "\"F:\xy\xyxnyz\pm2-resurrect.bat\"" /sc onlogon /rl highest /f
)

echo.
echo 当前 pm2 状态:
pm2 list

echo.
echo 验证任务:
schtasks /query /tn WorldSurvivalServer /fo LIST 2>nul || echo （如上无输出，可能是权限或任务不存在，请以管理员运行本文件）

echo.
echo =====================================================
echo 完成！
echo - 当前会话：服务器已在 pm2 后台运行（world-server）
echo - 下次用户登录：WorldSurvivalServer 任务会执行 pm2 resurrect 恢复它
echo.
echo 如需“开机无需登录也运行”（推荐服务器电脑）：
echo   1. 下载 nssm https://nssm.cc/download
echo   2. 把 nssm.exe 放到 F:\xy\xyxnyz
echo   3. 以管理员运行：install-as-windows-service.bat
echo.
echo 其他常用：
echo   pm2 list
echo   pm2 logs world-server
echo   pm2 restart world-server
echo =====================================================
pause
endlocal
