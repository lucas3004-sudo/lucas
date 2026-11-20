"""Daily brief -> briefs/YYYY-MM-DD.md (deterministic, no LLM: zero tokens). Every figure shows its provenance."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from . import control, db, queue
from .config import ROOT, load_env

BRIEFS_DIR = ROOT / "briefs"


def _day_bounds(day: str | None) -> tuple[str, str, str]:
    tz = ZoneInfo(load_env().timezone)
    d = datetime.fromisoformat(day).date() if day else datetime.now(timezone.utc).astimezone(tz).date()
    start = datetime(d.year, d.month, d.day, tzinfo=tz)
    return d.isoformat(), start.astimezone(timezone.utc).isoformat(timespec="seconds"), \
        (start + timedelta(days=1)).astimezone(timezone.utc).isoformat(timespec="seconds")


def build_daily_brief(day: str | None = None) -> tuple[str, str]:
    d, a, b = _day_bounds(day)
    st = control.state()
    produced = db.rows("SELECT id, title, platform, format, status FROM contents WHERE created_at>=? AND created_at<? ORDER BY created_at", (a, b))
    pending = db.rows("SELECT id, title, status FROM contents WHERE status IN ('awaiting_approval','waiting_assets','needs_revision','ready_to_publish')")
    upcoming = db.rows("SELECT id, title, platform, scheduled_at FROM contents WHERE status='scheduled' ORDER BY scheduled_at LIMIT 10")
    llm = db.one("SELECT COUNT(*) n, COALESCE(SUM(input_tokens),0) i, COALESCE(SUM(output_tokens),0) o, COALESCE(SUM(cost_usd),0) c "
                 "FROM llm_calls WHERE at>=? AND at<?", (a, b))
    by_prov = db.rows("SELECT provider, token_provenance p, COUNT(*) n FROM llm_calls WHERE at>=? AND at<? GROUP BY provider, p", (a, b))
    failed = db.rows("SELECT id, type, last_error FROM jobs WHERE status IN ('failed','dead') AND updated_at>=? AND updated_at<?", (a, b))
    msgs = db.one("SELECT COUNT(*) n, SUM(status='needs_human') h FROM messages WHERE created_at>=? AND created_at<?", (a, b))
    metrics = db.one("SELECT COUNT(*) n, COALESCE(SUM(views),0) v FROM metrics WHERE date=?", (d,))
    fin = db.one("SELECT COALESCE(SUM(CASE WHEN kind='revenue' THEN amount END),0) r, COALESCE(SUM(CASE WHEN kind='expense' THEN amount END),0) e "
                 "FROM finance_entries WHERE date=?", (d,))
    insights = db.rows("SELECT title, body FROM research_items WHERE kind='insight' ORDER BY created_at DESC LIMIT 3")

    L = [f"# Rapport quotidien — {d}", "",
         "_Généré automatiquement par l'Analyst (sans LLM). Provenance : [mesuré] API/plateforme, [manuel] saisi, [estimé] calculé._", "",
         "## État de l'agence", f"- Statut : **{st['status']}** · run courant : `{st['current_run_id'] or '—'}`",
         f"- File de tâches : {queue.counts() or 'vide'}", "",
         f"## Contenus produits aujourd'hui ({len(produced)})"]
    L += [f"- `{c['id']}` {c['title']} — {c['platform']}/{c['format']} — **{c['status']}**" for c in produced] or ["- aucun"]
    L += ["", f"## À faire par un humain ({len(pending)})"]
    L += [f"- `{c['id']}` {c['title']} — {c['status']}" for c in pending] or ["- rien"]
    L += ["", "## Publications prévues"]
    L += [f"- {c['scheduled_at']} — {c['platform']} — {c['title']}" for c in upcoming] or ["- aucune"]
    L += ["", "## Performances",
          f"- Statistiques saisies aujourd'hui : {metrics['n']} ligne(s), {metrics['v']} vues [manuel/mesuré selon source]"]
    L += [f"- Insight : {i['title']} — {i['body']}" for i in insights]
    L += ["", "## Communauté", f"- Messages reçus : {msgs['n']} · à traiter par un humain : {msgs['h'] or 0}", "",
          "## Ressources & coûts",
          f"- Appels LLM : {llm['n']} · tokens entrée/sortie : {llm['i']}/{llm['o']} · coût API : {llm['c']:.4f} USD [estimé d'après le tarif public]"]
    L += [f"  - {r['provider']} : {r['n']} appel(s), tokens [{r['p']}]" for r in by_prov]
    L += [f"- Finances du jour [manuel] : revenus {fin['r']:.2f} · dépenses {fin['e']:.2f}", "", "## Alertes"]
    L += [f"- Tâche `{j['type']}` en échec : {(j['last_error'] or '')[:160]}" for j in failed] or ["- aucune"]
    return d, "\n".join(L) + "\n"


def write_daily_brief(day: str | None = None) -> Path:
    d, md = build_daily_brief(day)
    BRIEFS_DIR.mkdir(exist_ok=True)
    path = BRIEFS_DIR / f"{d}.md"
    path.write_text(md, encoding="utf-8")
    return path
