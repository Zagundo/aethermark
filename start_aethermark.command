#!/bin/zsh
cd -- "${0:A:h}"
if ! command -v python3 >/dev/null 2>&1; then
  echo 'AetherMark needs Python 3.10 or later. Install Python from python.org, then try again.'
  read '?Press Return to close.'
  exit 1
fi
python3 launch.py "$@"
