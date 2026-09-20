#!/usr/bin/env python3
"""Build a portable Finder Open With app; no hardcoded checkout path."""
import argparse
from pathlib import Path
import plistlib
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', type=Path, default=ROOT / 'AetherMark.app')
args = parser.parse_args()
if args.output.exists():
    raise SystemExit(f'{args.output} already exists. Choose a fresh output path.')
subprocess.run(['osacompile', '-o', str(args.output), str(ROOT / 'AetherMark.applescript')], check=True)
resources = args.output / 'Contents/Resources/aethermark'
resources.mkdir()
for name in ['server.py', 'launch.py', 'index.html', 'app.js', 'style.css']:
    shutil.copy2(ROOT / name, resources / name)
shutil.copytree(ROOT / 'vendor', resources / 'vendor')
plist_path = args.output / 'Contents/Info.plist'
with plist_path.open('rb') as source:
    info = plistlib.load(source)
info.update(CFBundleIdentifier='com.zagundo.aethermark', CFBundleName='AetherMark', CFBundleShortVersionString='1.0.0', CFBundleDocumentTypes=[{
    'CFBundleTypeName': 'Markdown document', 'CFBundleTypeRole': 'Editor',
    'CFBundleTypeExtensions': ['md', 'markdown', 'txt'], 'LSHandlerRank': 'Alternate'
}])
with plist_path.open('wb') as destination:
    plistlib.dump(info, destination)
subprocess.run(['codesign', '--force', '--deep', '--sign', '-', str(args.output)], check=True)
print(args.output)
