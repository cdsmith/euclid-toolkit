# Serves the site (site/) at http://localhost:8000/, or another port: python serve.py 8080. A
# browser won't let a page opened as a file fetch its lessons. The browser suites start one of
# their own (tests/served.py).
import http.server, pathlib, sys, threading

SITE = pathlib.Path(__file__).resolve().parent / 'site'


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(SITE), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *args):
        pass


def start(port=0):
    """Serves in the background; returns the site's URL."""
    server = http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return f'http://127.0.0.1:{server.server_port}/'


if __name__ == '__main__':
    server = http.server.ThreadingHTTPServer(
        ('127.0.0.1', int(sys.argv[1]) if len(sys.argv) > 1 else 8000), Handler
    )
    print(f'http://localhost:{server.server_port}/')
    server.serve_forever()
