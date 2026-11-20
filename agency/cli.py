"""CLI: `python -m agency <command>`. Compact outputs on purpose (cheap to read inside Claude Code)."""
from __future__ import annotations

import argparse
import json
import sys
import threading
from pathlib import Path


def _print(obj) -> None:
    print(json.dumps(obj, ensure_ascii=False, indent=1, default=str))


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="agency", description="AI Agency OS")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("serve", help="API + dashboard + worker + scheduler in one process")
    sub.add_parser("api", help="API + dashboard only")
    sub.add_parser("worker", help="worker loop only")
    sub.add_parser("scheduler", help="scheduler loop only")
    sub.add_parser("status", help="agency state + queue counts")
    lp = sub.add_parser("launch", help="launch a run")
    lp.add_argument("--contents", type=int)
    wp = sub.add_parser("work", help="process ready jobs now")
    wp.add_argument("--once", action="store_true")
    wp.add_argument("--force", action="store_true", help="ignore paused/stopped state")
    cc = sub.add_parser("cc", help="Claude Code task exchange")
    cc.add_argument("action", choices=["list", "show", "submit"])
    cc.add_argument("task_id", nargs="?")
    cc.add_argument("file", nargs="?", help="JSON result file (or - for stdin)")
    sub.add_parser("character", help="print compact character bible")
    bp = sub.add_parser("brief", help="write today's brief to briefs/")
    bp.add_argument("--date")
    sub.add_parser("usage-import", help="import local Claude Code transcripts usage")
    a = p.parse_args(argv)

    from . import worker
    worker.boot()
    from . import control, queue

    if a.cmd in ("serve", "api"):
        import uvicorn
        from .api.app import create_app
        from .config import load_env
        env = load_env()
        if a.cmd == "serve":
            stop = threading.Event()
            threading.Thread(target=worker.loop, args=(stop,), daemon=True).start()
            threading.Thread(target=worker.scheduler_loop, args=(stop,), daemon=True).start()
        print(f"Dashboard: http://{env.host}:{env.port}  (API docs: /api/docs)")
        uvicorn.run(create_app(), host=env.host, port=env.port, log_level="warning")
    elif a.cmd == "worker":
        worker.loop(threading.Event())
    elif a.cmd == "scheduler":
        worker.scheduler_loop(threading.Event())
    elif a.cmd == "status":
        _print({"agency": control.state(), "jobs": queue.counts()})
    elif a.cmd == "launch":
        _print(control.launch("cli", {"contents": a.contents} if a.contents else None))
    elif a.cmd == "work":
        _print({"processed": worker.run_once(ignore_state=a.force)})
    elif a.cmd == "cc":
        from .llm import claude_code
        if a.action == "list":
            _print(claude_code.list_tasks())
        elif a.action == "show":
            _print(claude_code.get_task(a.task_id))
        else:
            raw = sys.stdin.read() if a.file in (None, "-") else Path(a.file).read_text(encoding="utf-8")
            _print(claude_code.submit(a.task_id, json.loads(raw)))
    elif a.cmd == "character":
        from .agents.character import active_character, compact_bible
        print(compact_bible(active_character()))
    elif a.cmd == "brief":
        from .reports import write_daily_brief
        print(write_daily_brief(a.date))
    elif a.cmd == "usage-import":
        from .usage import import_claude_code
        _print(import_claude_code())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
