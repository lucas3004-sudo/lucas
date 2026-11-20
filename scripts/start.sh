#!/usr/bin/env bash
cd "$(dirname "$0")/.."
( sleep 2; (command -v open >/dev/null && open http://127.0.0.1:8000) || (command -v xdg-open >/dev/null && xdg-open http://127.0.0.1:8000) || true ) &
exec .venv/bin/python -m agency serve
