# fix-pm2-autostart.ps1
# 以管理员身份运行此脚本，确保 world-server 通过 pm2 在登录时自启

$ErrorActionPreference = "Continue"
$project = "F:\xy\xyxnyz"
$taskName = "WorldSurvivalServer"

Write-Host "=== 修复/安装 PM2 登录自启动 ===" -ForegroundColor Cyan
Write-Host "项目目录: $project"

Set-Location $project

Write-Host "`n[1] pm2 save 当前进程..."
& pm2 save | Out-Null

Write-Host "[2] 删除旧任务（如果存在）..."
schtasks /delete /tn $taskName /f 2>$null | Out-Null

Write-Host "[3] 创建计划任务 $taskName (登录时执行 pm2 resurrect)..."

$bat = Join-Path $project "pm2-resurrect.bat"

$action = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c `"$bat`"" `
    -WorkingDirectory $project

$trigger = New-ScheduledTaskTrigger -AtLogOn

$principal = New-ScheduledTaskPrincipal `
    -UserId "$env:USERDOMAIN\$env:USERNAME" `
    -RunLevel Highest

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable

try {
    Register-ScheduledTask `
        -TaskName $taskName `
        -Action $action `
        -Trigger $trigger `
        -Principal $principal `
        -Settings $settings `
        -Force | Out-Null
    Write-Host "任务注册成功: $taskName" -ForegroundColor Green
} catch {
    Write-Host "PowerShell 注册失败，尝试 schtasks 备用..." -ForegroundColor Yellow
    $cmd = "schtasks /create /tn `"$taskName`" /tr `"cmd /c `"$bat`"`" /sc onlogon /rl highest /f"
    Invoke-Expression $cmd
}

Write-Host "`n当前 pm2 状态:"
& pm2 list

Write-Host "`n验证任务:"
schtasks /query /tn $taskName /fo LIST 2>$null

Write-Host "`n完成。"
Write-Host "- 当前会话服务器已在 pm2 后台运行"
Write-Host "- 登录后会自动恢复 (pm2 resurrect)"
Write-Host ""
Write-Host "如需开机无需登录也运行，请安装 NSSM 并运行 install-as-windows-service.bat"
Write-Host ""
pause
