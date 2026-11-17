# 本地开发服务器：0.0.0.0:8000，根目录 www/，禁用缓存（手机刷新即得最新版本）
# 用法: python serve.py
import http.server
import os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'www')
os.chdir(ROOT)


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


http.server.ThreadingHTTPServer.allow_reuse_address = True
http.server.ThreadingHTTPServer(('0.0.0.0', 8000), NoCacheHandler).serve_forever()
