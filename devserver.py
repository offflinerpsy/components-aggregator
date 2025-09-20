from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import os
class H(SimpleHTTPRequestHandler):
    def end_headers(self):
        p=self.path
        if p.endswith('.html'): self.send_header('Content-Type','text/html; charset=utf-8')
        if p.endswith('.js'):   self.send_header('Content-Type','application/javascript; charset=utf-8')
        if p.endswith('.css'):  self.send_header('Content-Type','text/css; charset=utf-8')
        super().end_headers()
os.chdir(r'C:\Users\Makkaroshka\Documents\GitHub\components-aggregator')
ThreadingHTTPServer(('127.0.0.1',5173), H).serve_forever()
