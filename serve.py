#!/usr/bin/env python3
"""开发预览服务器：python http.server + no-cache 头，避免浏览器缓存 index.html"""
import http.server
import socketserver
import os

PORT = 8899
ROOT = os.path.dirname(os.path.abspath(__file__))   # 仓库根目录，保持 /purelab-apk/... URL 不变


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


if __name__ == '__main__':
    with socketserver.ThreadingTCPServer(('0.0.0.0', PORT), NoCacheHandler) as httpd:
        print(f'serving {ROOT} at http://127.0.0.1:{PORT}/purelab-apk/app/assets/www/index.html (no-cache)')
        httpd.serve_forever()
