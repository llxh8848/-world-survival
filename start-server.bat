@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 世界生存 - 局域网服务器 (8090)

echo ==========================================
echo   世界生存 局域网服务器
echo ==========================================
echo.

:: 显示本机和局域网地址
echo 本机访问: http://localhost:8090
for /f "usebackq tokens=2 delims=:" %%a in (`ipconfig ^| findstr /c:"IPv4"`) do (
    set "raw=%%a"
    setlocal enabledelayedexpansion
    set "ip=!raw: =!"
    if not "!ip!"=="127.0.0.1" if not "!ip!"=="" (
        echo 局域网访问: http://!ip!:8090
    )
    endlocal
) 2>nul
if not defined ip echo 局域网访问: http://[本机IP]:8090
echo.
echo 提示: 其他玩家在浏览器打开上面的局域网地址即可加入
echo 提示: 不要关闭此窗口，服务器会一直运行
echo 提示: 按 Ctrl+C 可手动停止
echo.
echo 服务器启动中...
echo.

:loop
node server.js
echo.
echo [警告] 服务器已停止，5 秒后自动重启...
timeout /t 5 >nul
goto loop
