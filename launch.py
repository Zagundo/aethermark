#!/usr/bin/env python3
"""Start/reuse this checkout's server and open files in the default browser."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import webbrowser

ROOT = Path(__file__).resolve().parent


def request(url, data=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(url, data=json.dumps(data).encode() if data else None, headers=headers)
    with urllib.request.urlopen(req, timeout=3) as response:
        return json.load(response)


def launch(files=(), open_browser=True):
    # Per-user, per-checkout runtime state. No credentials are stored in the repo.
    tag = hashlib.sha256(str(ROOT).encode()).hexdigest()[:12]
    runtime_dir = Path(tempfile.gettempdir()) / f'aethermark-{os.getuid()}-{tag}'
    runtime_dir.mkdir(mode=0o700, exist_ok=True)
    if runtime_dir.is_symlink() or runtime_dir.stat().st_uid != os.getuid():
        raise RuntimeError('Unsafe runtime directory.')
    os.chmod(runtime_dir, 0o700)
    runtime = runtime_dir / 'session.json'
    with (runtime_dir / 'launch.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        session = None
        try:
            candidate = json.loads(runtime.read_text())
            health = request(f"http://127.0.0.1:{candidate['port']}/api/health")
            if health.get('app') == 'AetherMark' and health.get('root') == str(ROOT):
                session = candidate
        except (OSError, ValueError, KeyError):
            pass
        if session is None:
            # Try the stable browser origin first; use an available port if occupied.
            for port in (9001, 0):
                runtime.unlink(missing_ok=True)
                with (runtime_dir / 'server.log').open('ab') as log:
                    process = subprocess.Popen([sys.executable, str(ROOT / 'server.py'), str(port), '--runtime', str(runtime)], cwd=ROOT, stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True)
                for _ in range(40):
                    if runtime.exists():
                        candidate = json.loads(runtime.read_text())
                        try:
                            health = request(f"http://127.0.0.1:{candidate['port']}/api/health")
                            if health.get('root') == str(ROOT):
                                session = candidate
                                break
                        except OSError:
                            pass
                    if process.poll() is not None:
                        break
                    time.sleep(.1)
                if session:
                    break
            if session is None:
                raise RuntimeError(f'Could not start AetherMark. See {runtime_dir / "server.log"}')
        base = f"http://127.0.0.1:{session['port']}"
        urls = []
        for name in files:
            result = request(base + '/api/register-file', {'path': str(Path(name).expanduser().resolve())}, session['token'])
            urls.append(base + '/?file=' + result['id'])
        if not urls:
            urls.append(base + '/')
        for url in urls:
            print(url)
            if open_browser:
                webbrowser.open(url)
        return urls


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('files', nargs='*')
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    try:
        launch(args.files, not args.no_browser)
    except (OSError, ValueError, RuntimeError) as error:
        print(f'AetherMark: {error}', file=sys.stderr)
        sys.exit(1)
