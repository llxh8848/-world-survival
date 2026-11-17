# 设置 PM2 world-server 开机/登录自启
# 以管理员身份运行此脚本

$ErrorActionPreference = "Stop"
$projectDir = "F:\xy\xyxnyz"
$taskName = "WorldSurvivalServer"

Write-Host "=== 世界生存服务器 PM2 自启动设置 ===" -ForegroundColor Cyan
Write-Host "项目目录: $projectDir"
Write-Host ""

# 确保在项目目录
Set-Location $projectDir

# 1. 确保 pm2 进程已保存
Write-Host "[1/4] 保存 pm2 进程列表..."
& pm2 save | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  正在启动服务器到 pm2..."
    & pm2 start server.js --name world-server
    & pm2 save | Out-Null
}
Write-Host "  已保存到 $env:USERPROFILE\.pm2\dump.pm2"

# 2. 删除旧任务
Write-Host "[2/4] 清理旧任务..."
schtasks /delete /tn $taskName /f 2>$null | Out-Null

# 3. 创建新计划任务：用户登录时执行 pm2 resurrect
# 使用 PowerShell 注册，更可靠
Write-Host "[3/4] 创建登录自启计划任务: $taskName"

$action = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c pm2 resurrect" `
    -WorkingDirectory $projectDir

$trigger = New-ScheduledTaskTrigger -AtLogOn

$principal = New-ScheduledTaskPrincipal `
    -UserId "$env:USERDOMAIN\$env:USERNAME" `
    -RunLevel Highest `
    -LogonType Interactive

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

    Write-Host "  任务创建成功！" -ForegroundColor Green
} catch {
    Write-Host "  使用 schtasks 备用方式..." -ForegroundColor Yellow
    schtasks /create /tn $taskName /tr "cmd.exe /c pm2 resurrect" /sc onlogon /rl highest /f
}

# 4. 可选桌面快捷方式
Write-Host "[4/4] 创建桌面快捷方式..."
$shortcutPath = [Environment]::GetFolderPath("Desktop") + "\世界生存-恢复服务器.lnk"
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($shortcutPath)
$sc.TargetPath = "cmd.exe"
$sc.Arguments = "/c pm2 resurrect"
$sc.WorkingDirectory = $projectDir
$sc.WindowStyle = 7
$sc.Save()
Write-Host "  桌面快捷方式已创建: $shortcutPath"

Write-Host ""
Write-Host "=== 当前状态 ===" -ForegroundColor Cyan
& pm2 list

Write-Host ""
Write-Host "完成！" -ForegroundColor Green
Write-Host "- 当前会话：服务器已在 pm2 后台运行"
Write-Host "- 下次登录：计划任务会自动 'pm2 resurrect' 恢复服务器"
Write-Host ""
Write-Host "如需无需登录也运行（推荐用于服务器电脑），请使用 NSSM 注册 Windows 服务。"
Write-Host "详见 一直开机联机说明.txt"
Write-Host ""
pause
