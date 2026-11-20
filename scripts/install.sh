#!/usr/bin/env bash
# AI Agency OS - installation macOS / Linux.  Usage : bash scripts/install.sh
set -euo pipefail
cd "$(dirname "$0")/.."
echo "== AI Agency OS : installation =="
PY=$(command -v python3.13 || command -v python3.12 || command -v python3.11 || command -v python3 || true)
[ -z "$PY" ] && { echo "Python 3.11+ introuvable (https://www.python.org)"; exit 1; }
"$PY" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)' || { echo "Python 3.11+ requis ($("$PY" --version))"; exit 1; }
[ -d .venv ] || "$PY" -m venv .venv
.venv/bin/python -m pip install --upgrade pip -q
.venv/bin/python -m pip install -e ".[api,dev]" -q
[ -f .env ] || { cp .env.example .env; echo ".env créé (ajoutez vos clés plus tard)."; }
command -v ffmpeg >/dev/null || echo "ffmpeg absent : macOS -> brew install ffmpeg ; Debian/Ubuntu -> sudo apt install ffmpeg"
.venv/bin/python -m agency doctor || true
echo "Pour lancer : bash scripts/start.sh"
