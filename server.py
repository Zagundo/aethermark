#!/usr/bin/env python3
"""AetherMark's loopback-only server. Python standard library; no pip install."""
import argparse
import hashlib
import json
import mimetypes
import os
from pathlib import Path
import secrets
import tempfile
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parent
MAX_BYTES = 8 * 1024 * 1024
EXTENSIONS = {'.md', '.markdown', '.txt'}
ASSETS = {'index.html', 'app.js', 'style.css', 'vendor/marked.umd.js', 'vendor/purify.min.js'}


def revision(data):
    return hashlib.sha256(data).hexdigest()


def read_document(path):
    if path.stat().st_size > MAX_BYTES:
        raise ValueError('File exceeds the 8 MB limit.')
    data = path.read_bytes()
    return {'content': data.decode('utf-8'), 'filename': path.name, 'revision': revision(data)}


class AetherMarkRequestHandler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass  # Never log document paths, contents, or capability tokens.

    def respond(self, status, data, content_type='application/json; charset=utf-8'):
        body = json.dumps(data).encode() if isinstance(data, (dict, list)) else data
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def error(self, status, message):
        self.respond(status, {'error': message})

    def trusted_request(self):
        port = self.server.server_port
        hosts = {f'127.0.0.1:{port}', f'localhost:{port}'}
        origin = self.headers.get('Origin')
        if self.headers.get('Host') not in hosts or (origin and origin not in {'http://' + h for h in hosts}):
            self.error(403, 'Only same-origin local requests are allowed.')
            return False
        if self.headers.get('Sec-Fetch-Site') == 'cross-site':
            self.error(403, 'Cross-site requests are not allowed.')
            return False
        return True

    def do_GET(self):
        if not self.trusted_request():
            return
        url = urlsplit(self.path)
        if url.path == '/api/health':
            self.respond(200, {'app': 'AetherMark', 'version': 1, 'root': str(ROOT)})
        elif url.path == '/api/session':
            self.respond(200, {'token': self.server.session_token})
        elif url.path == '/api/get-file':
            file_id = parse_qs(url.query).get('id', [''])[0]
            path = self.server.grants.get(file_id)
            if path is None:
                self.error(403, 'Open this file with the AetherMark launcher first.')
                return
            try:
                if path.is_symlink():
                    raise ValueError('The file was replaced by a symbolic link. Reopen it.')
                self.respond(200, read_document(path))
            except (OSError, ValueError) as exc:
                self.error(400, str(exc))
        else:
            asset = 'index.html' if url.path == '/' else url.path.removeprefix('/')
            if asset not in ASSETS:
                self.error(404, 'Not found')
                return
            try:
                data = (ROOT / asset).read_bytes()
                kind = mimetypes.guess_type(asset)[0] or 'application/octet-stream'
                self.respond(200, data, kind + '; charset=utf-8')
            except OSError:
                self.error(404, 'Asset unavailable')

    do_HEAD = do_GET

    def do_POST(self):
        if not self.trusted_request():
            return
        route = urlsplit(self.path).path
        if route == '/api/register-file':
            authorized = secrets.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + self.server.launch_token)
        elif route == '/api/save-file':
            authorized = secrets.compare_digest(self.headers.get('X-AetherMark-Token', ''), self.server.session_token)
        else:
            self.error(404, 'Not found')
            return
        if not authorized:
            self.error(403, 'Missing or invalid local session token.')
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length < 1 or length > MAX_BYTES + 1024 * 1024:
                self.error(413, 'Document exceeds the request size limit.')
                return
            if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
                self.error(415, 'Expected application/json')
                return
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError('Expected a JSON object.')
            if route == '/api/register-file':
                path = Path(data['path']).expanduser().resolve(strict=True)
                if not path.is_file() or path.suffix.lower() not in EXTENSIONS:
                    raise ValueError('Choose a Markdown or text file.')
                read_document(path)  # Check size and UTF-8 before granting access.
                file_id = secrets.token_urlsafe(24)
                self.server.grants[file_id] = path
                self.respond(200, {'id': file_id})
            else:
                self.save_document(data)
        except (KeyError, TypeError, ValueError, OSError) as exc:
            self.error(400, str(exc))

    def save_document(self, data):
        path = self.server.grants.get(data.get('id'))
        if path is None:
            self.error(403, 'File has not been explicitly opened.')
            return
        content = data.get('content')
        if not isinstance(content, str):
            raise ValueError('Content must be a string.')
        encoded = content.encode('utf-8')
        if len(encoded) > MAX_BYTES:
            raise ValueError('File exceeds the 8 MB limit.')
        if path.is_symlink():
            raise ValueError('The file was replaced by a symbolic link. Reopen it.')
        current = path.read_bytes()
        if data.get('revision') != revision(current):
            self.error(409, 'File changed on disk. Export your draft, then reopen the file to compare changes.')
            return
        # Write beside the original and atomically replace it. Never truncate on failure.
        fd, temporary = tempfile.mkstemp(prefix='.aethermark-', dir=path.parent)
        try:
            with os.fdopen(fd, 'wb') as out:
                out.write(encoded)
                out.flush()
                os.fsync(out.fileno())
            os.chmod(temporary, path.stat().st_mode & 0o777)
            # Check again after preparing the replacement.
            if path.is_symlink() or revision(path.read_bytes()) != data.get('revision'):
                self.error(409, 'File changed during save. Your draft has been kept.')
                return
            os.replace(temporary, path)
        finally:
            Path(temporary).unlink(missing_ok=True)
        self.respond(200, {'success': True, 'revision': revision(encoded)})


def make_server(port=9001):
    httpd = HTTPServer(('127.0.0.1', port), AetherMarkRequestHandler)
    httpd.session_token = secrets.token_urlsafe(32)
    httpd.launch_token = secrets.token_urlsafe(32)
    httpd.grants = {}
    return httpd


def run():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('port', type=int, nargs='?', default=9001)
    parser.add_argument('--runtime', type=Path)
    args = parser.parse_args()
    with make_server(args.port) as httpd:
        if args.runtime:
            fd = os.open(args.runtime, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, 'w') as out:
                json.dump({'port': httpd.server_port, 'token': httpd.launch_token, 'root': str(ROOT)}, out)
        print(f'AetherMark: http://127.0.0.1:{httpd.server_port}', flush=True)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    run()
