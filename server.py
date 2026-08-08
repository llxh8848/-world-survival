import http.server
import socketserver
import os
import mimetypes
import json

PORT = 8090
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
BUILDINGS_DIR = os.path.join(DIRECTORY, 'buildings_data')

mimetypes.add_type('text/html; charset=utf-8', '.html')
mimetypes.add_type('text/css; charset=utf-8', '.css')
mimetypes.add_type('application/javascript; charset=utf-8', '.js')
mimetypes.add_type('text/plain; charset=utf-8', '.txt')
mimetypes.add_type('application/json; charset=utf-8', '.json')

class UTF8HTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        self.headers['Access-Control-Allow-Origin'] = '*'
        self.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
        self.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_POST(self):
        # POST /api/buildings/<roomId> -> 保存建筑状态
        if self.path.startswith('/api/buildings/'):
            room_id = self.path[len('/api/buildings/'):]
            # 安全：只允许字母数字下划线
            if not all(c.isalnum() or c in '_-' for c in room_id):
                self.send_error(400, 'Invalid room id')
                return
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body)
                os.makedirs(BUILDINGS_DIR, exist_ok=True)
                filepath = os.path.join(BUILDINGS_DIR, room_id + '.json')
                with open(filepath, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False)
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': True}).encode())
            except Exception as e:
                self.send_error(500, str(e))
        else:
            self.send_error(404)

    def do_GET(self):
        # GET /api/buildings/<roomId> -> 加载建筑状态
        if self.path.startswith('/api/buildings/'):
            room_id = self.path[len('/api/buildings/'):]
            if not all(c.isalnum() or c in '_-' for c in room_id):
                self.send_error(400, 'Invalid room id')
                return
            filepath = os.path.join(BUILDINGS_DIR, room_id + '.json')
            if os.path.exists(filepath):
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        data = f.read()
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(data.encode())
                except Exception as e:
                    self.send_error(500, str(e))
            else:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'buildings': []}).encode())
        else:
            super().do_GET()

with socketserver.TCPServer(("", PORT), UTF8HTTPRequestHandler) as httpd:
    print(f"Serving at port {PORT}")
    httpd.serve_forever()
