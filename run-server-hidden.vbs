' 隐藏窗口运行服务器（不显示黑框）
' 双击此文件即可后台启动服务器
' 服务器崩溃会由 start-server.bat 自动重启

Set WshShell = CreateObject("WScript.Shell")
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
batPath = scriptDir & "\start-server.bat"

' 0 = 隐藏窗口, 1 = 正常, 7 = 最小化
WshShell.Run """" & batPath & """", 0, False
Set WshShell = Nothing

WScript.Echo "服务器已在后台启动。" & vbCrLf & _
             "如需停止，请在任务管理器结束 node.exe 进程。" & vbCrLf & _
             "或运行: taskkill /F /IM node.exe"
