import http.client
import json
import tempfile
import threading
import unittest
from urllib.parse import quote
from unittest.mock import patch
from pathlib import Path
import server


class ServerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.file = Path(self.temp.name) / 'A 100% note.md'
        self.file.write_text('# Original\n', encoding='utf-8')
        self.httpd = server.make_server(0)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        self.port = self.httpd.server_port
        self.origin = f'http://127.0.0.1:{self.port}'

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.thread.join()
        self.temp.cleanup()

    def request(self, method, path, data=None, headers=None):
        conn = http.client.HTTPConnection('127.0.0.1', self.port)
        body = json.dumps(data) if data is not None else None
        conn.request(method, path, body, headers or {})
        response = conn.getresponse()
        raw = response.read()
        status = response.status
        conn.close()
        try:
            result = json.loads(raw)
        except ValueError:
            result = raw
        return status, result

    def grant(self):
        status, body = self.request('POST', '/api/register-file', {'path': str(self.file)}, {
            'Content-Type': 'application/json', 'Authorization': 'Bearer ' + self.httpd.launch_token})
        self.assertEqual(status, 200)
        return body['id']

    def save(self, data, headers=None):
        return self.request('POST', '/api/save-file', data, headers or {
            'Content-Type': 'application/json', 'Origin': self.origin,
            'X-AetherMark-Token': self.httpd.session_token})

    def test_granted_file_roundtrip_and_conflict(self):
        file_id = self.grant()
        status, data = self.request('GET', '/api/get-file?id=' + file_id)
        self.assertEqual(status, 200)
        self.assertEqual(data['content'], '# Original\n')
        status, saved = self.save({'id': file_id, 'content': '# Changed\n', 'revision': data['revision']})
        self.assertEqual(status, 200)
        self.assertEqual(self.file.read_text(), '# Changed\n')
        self.file.write_text('# External\n')
        self.assertEqual(self.save({'id': file_id, 'content': 'stale', 'revision': saved['revision']})[0], 409)
        self.assertEqual(self.file.read_text(), '# External\n')

    def test_rejects_unauthorized_paths_and_writes(self):
        self.assertEqual(self.request('GET', '/api/get-file?path=' + quote(str(self.file)))[0], 403)
        self.assertEqual(self.save({'path': str(self.file), 'content': 'bad'})[0], 403)
        self.assertEqual(self.request('POST', '/api/register-file', {'path': str(self.file)})[0], 403)
        self.assertEqual(self.save({}, {'Content-Type': 'application/json', 'Origin': 'https://evil.example'})[0], 403)
        self.assertEqual(self.file.read_text(), '# Original\n')

    def test_static_allowlist_and_host(self):
        for path in ['/server.py', '/.git/config', '/README.md', '/vendor/../server.py', '/']:
            status, _ = self.request('GET', path)
            self.assertEqual(status, 200 if path == '/' else 404, path)
        self.assertEqual(self.request('GET', '/', headers={'Host': 'evil.example'})[0], 403)

    def test_failed_replacement_preserves_original_and_cleans_temporary_file(self):
        file_id = self.grant()
        _, data = self.request('GET', '/api/get-file?id=' + file_id)
        with patch('server.os.replace', side_effect=OSError('Simulated disk failure')):
            self.assertEqual(self.save({'id': file_id, 'content': 'replacement', 'revision': data['revision']})[0], 400)
        self.assertEqual(self.file.read_text(), '# Original\n')
        self.assertEqual(list(self.file.parent.glob('.aethermark-*')), [])

    def test_token_and_origin_both_required_for_browser_writes(self):
        file_id = self.grant()
        _, data = self.request('GET', '/api/get-file?id=' + file_id)
        payload = {'id': file_id, 'content': 'bad', 'revision': data['revision']}
        self.assertEqual(self.save(payload, {'Content-Type': 'application/json', 'Origin': self.origin})[0], 403)
        self.assertEqual(self.save(payload, {'Content-Type': 'application/json', 'Origin': 'https://evil.example', 'X-AetherMark-Token': self.httpd.session_token})[0], 403)
        self.assertEqual(self.request('GET', '/api/session', headers={'Origin': 'https://evil.example'})[0], 403)

    def test_replaced_symlink_is_not_followed(self):
        file_id = self.grant()
        _, data = self.request('GET', '/api/get-file?id=' + file_id)
        other = self.file.parent / 'other.md'
        other.write_text('Do not change')
        self.file.unlink()
        self.file.symlink_to(other)
        self.assertEqual(self.save({'id': file_id, 'content': 'bad', 'revision': data['revision']})[0], 400)
        self.assertEqual(other.read_text(), 'Do not change')
        self.assertEqual(self.request('GET', '/api/get-file?id=' + file_id)[0], 400)

    def test_invalid_file_and_payload(self):
        self.file = Path(self.temp.name) / 'secret.py'
        self.file.write_text('secret')
        self.assertEqual(self.request('POST', '/api/register-file', {'path': str(self.file)}, {
            'Content-Type': 'application/json', 'Authorization': 'Bearer ' + self.httpd.launch_token})[0], 400)
        self.assertEqual(self.save([])[0], 400)


if __name__ == '__main__':
    unittest.main()
