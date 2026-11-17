@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 安装为 Windows 服务（开机无需登录）

echo =====================================================
echo   把服务器注册为 Windows 服务（推荐一直开着）
echo   项目: %CD%
echo   服务名: WorldSurvival
echo =====================================================
echo.

if not exist nssm.exe (
    echo [错误] 当前目录没有 nssm.exe
    echo.
    echo 请：
    echo 1. 打开浏览器访问 https://nssm.cc/download
    echo 2. 下载 nssm-2.24.zip （或最新版）
    echo 3. 解压后把 nssm.exe 复制到本目录 F:\xy\xyxnyz
    echo 4. 再次双击本文件
    echo.
    pause
    exit /b 1
)

echo 找到 nssm.exe
echo.

:: 如果服务已存在，先删除
nssm status WorldSurvival >nul 2>nul
if %errorlevel%==0 (
    echo 服务已存在，正在停止并删除旧服务...
    nssm stop WorldSurvival >nul 2>nul
    nssm remove WorldSurvival confirm >nul 2>nul
    timeout /t 1 >nul
)

echo 正在安装服务...
nssm install WorldSurvival "%ProgramFiles%\nodejs\node.exe" server.js
nssm set WorldSurvival AppDirectory "%CD%"
nssm set WorldSurvival DisplayName "世界生存服务器 (8090)"
nssm set WorldSurvival Description "世界生存游戏联机服务器，局域网持久运行"
nssm set WorldSurvival Start SERVICE_AUTO_START
nssm set WorldSurvival AppStdout "%CD%\server.log"
nssm set WorldSurvival AppStderr "%CD%\server-error.log"
nssm set WorldSurvival AppRotateFiles 1
nssm set WorldSurvival AppRotateOnline 1

echo.
echo 安装完成，正在启动服务...
nssm start WorldSurvival

echo.
echo =====================================================
echo 服务状态：
nssm status WorldSurvival

echo.
echo 完成！
echo - 开机即自动启动（无需登录）
echo - 崩溃会自动重启（Windows 服务机制）
echo - 日志：server.log / server-error.log
echo.
echo 常用命令（管理员 CMD）：
echo   nssm start WorldSurvival
echo   nssm stop WorldSurvival
echo   nssm restart WorldSurvival
echo   nssm status WorldSurvival
echo   nssm remove WorldSurvival confirm   （卸载服务）
echo.
echo 查看日志：
echo   type server.log
echo   type server-error.log
echo.
echo 如需改用 pm2 管理，可先 nssm remove 卸载本服务。
echo =====================================================
pause
