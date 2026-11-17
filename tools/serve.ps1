# 世界生存重置版 静态服务器守护进程
# 循环重启：python http.server 崩溃后1s自动拉起
while ($true) {
    python -m http.server 8090 --bind 0.0.0.0 --directory F:\xy\xyxnyz\www
    Start-Sleep 1
}
