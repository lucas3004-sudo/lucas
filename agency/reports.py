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


def build_weekly_review() -> tuple[str, str]:
    """Weekly strategy review (deterministic): winners, losers, allocation, experiments, slots, accounts, targets, collabs."""
    from . import growth
    tz = ZoneInfo(load_env().timezone)
    now = datetime.now(timezone.utc).astimezone(tz)
    week = f"{now.isocalendar().year}-W{now.isocalendar().week:02d}"
    perf = [p for p in growth.performance() if p["perf_index"] is not None]
    top = sorted(perf, key=lambda p: -p["perf_index"])[:5]
    flop = sorted(perf, key=lambda p: p["perf_index"])[:3]
    arms = growth.arm_stats()
    L = [f"# Revue stratégique — semaine {week}", "",
         "_Analyst, sans LLM. Indice = vues / médiane de la plateforme. Statistiques saisies = [manuel] ; projections = [prévision]._", "",
         "## Gagnants (à décliner)"]
    thr = float(db.setting("double_down_index") or 2.0)
    L += [f"- ×{p['perf_index']} — {p['title']} ({p['platform']}/{p['format']}, hook {p['hook_type'] or '?'}) "
          + ("→ suite déjà créée" if p["doubled_down"] else "→ suite au prochain run" if p["perf_index"] >= thr else "")
          for p in top] or ["- pas encore assez de données (≥ 3 contenus mesurés par plateforme)"]
    L += ["", "## À retravailler ou arrêter"]
    L += [f"- ×{p['perf_index']} — {p['title']} ({p['platform']}/{p['format']})" for p in flop] or ["- —"]
    L += ["", "## Allocation (bandit : probabilité moyenne de dépasser la médiane)"]
    for dim, label in (("pillars", "Piliers"), ("formats", "Formats")):
        ranked = sorted(arms[dim].items(), key=lambda kv: -kv[1]["posterior_mean"])
        L.append(f"- {label} : " + (", ".join(f"{k} {v['posterior_mean']:.0%} ({v['wins']}/{v['wins'] + v['losses']})" for k, v in ranked) or "exploration (aucune donnée)"))
    L += ["", "## Expériences A/B"]
    for e in db.rows("SELECT * FROM experiments ORDER BY created_at DESC LIMIT 5"):
        ev = growth.evaluate_experiment(e) if e["status"] == "running" else None
        L.append(f"- [{e['status']}] {e['hypothesis']} — " + (e["result"] or (ev and ev["decision"]) or "—"))
    L += ["", "## Meilleurs créneaux"]
    for platform in ("tiktok", "instagram", "youtube", "snapchat"):
        sl = growth.best_slots(platform)
        L.append(f"- {platform} : " + (", ".join(f"{s['slot']} (×{s['avg_index']}, n={s['n']})" for s in sl[:3]) if sl else "données insuffisantes"))
    L += ["", "## Comptes"]
    for a in db.rows("SELECT * FROM accounts ORDER BY platform"):
        posts = db.scalar("SELECT COUNT(*) FROM contents WHERE account_id=? AND status='published' AND published_at>=?", (a["id"], db.now(-7 * 86400)))
        warn = db.scalar("SELECT COUNT(*) FROM account_events WHERE account_id=? AND kind IN ('warning','restriction') AND at>=?", (a["id"], db.now(-30 * 86400)))
        L.append(f"- {a['platform']} {a['handle']} — {a['status']} — {posts} publication(s)/7 j (quota {a['daily_quota']}/j) — avertissements 30 j : {warn}")
    if not db.scalar("SELECT COUNT(*) FROM accounts"):
        L.append("- aucun compte enregistré (page Comptes)")
    L += ["", "## Objectifs"]
    for t in growth.targets_progress():
        fc = t["forecast"]
        L.append(f"- {t['metric']} {t['handle'] or 'global'} : {t['current']} / {t['target']} avant {t['deadline']} [{t['current_provenance']}]"
                 + (f" — projection {fc['projected']} ({'en route' if t['on_track'] else 'en retard'}) [prévision]" if fc else ""))
    L += ["", "## Partenariats"]
    L += [f"- {r['stage']} : {r['n']}" for r in db.rows("SELECT stage, COUNT(*) n FROM collabs GROUP BY stage")] or ["- aucun"]
    cost = db.scalar("SELECT COALESCE(SUM(cost_usd),0) FROM llm_calls WHERE at>=?", (db.now(-7 * 86400),))
    L += ["", "## Coûts", f"- API Claude 7 j : {cost:.4f} USD [estimé]", "", "## Alertes ouvertes"]
    L += [f"- {a['title']} — {a['body']}" for a in growth.anomalies()] or ["- aucune"]
    return week, "\n".join(L) + "\n"


def write_weekly_review() -> Path:
    week, md = build_weekly_review()
    BRIEFS_DIR.mkdir(exist_ok=True)
    path = BRIEFS_DIR / f"weekly-{week}.md"
    path.write_text(md, encoding="utf-8")
    return path


def build_todo() -> list[dict]:
    """Morning to-do: only what needs a human, most important first. Deterministic (zero tokens)."""
    from . import growth
    from .llm import claude_code
    items: list[dict] = []

    def add(prio: int, cat: str, title: str, detail: str = "", link: str = "#/daily", n: int = 1) -> None:
        if n:
            items.append({"priority": prio, "category": cat, "title": title, "detail": detail, "link": link, "count": n})

    for a in growth.anomalies():
        add(1, "alerte", a["title"], a["body"], a["link"])
    q = lambda st: db.rows("SELECT id, title, platform FROM contents WHERE status=? ORDER BY updated_at", (st,))  # noqa: E731
    appr, assets, rev = q("awaiting_approval"), q("waiting_assets"), q("needs_revision")
    add(2, "validation", f"Valider {len(appr)} contenu(s)", ", ".join(c["title"] for c in appr[:3]), "#/daily", len(appr))
    add(2, "visuels", f"Générer {len(assets)} visuel(s) dans Alexya et les déposer", ", ".join(c["title"] for c in assets[:3]), "#/generator", len(assets))
    day_end = db.now(86400)
    pub = db.rows("SELECT id, title, platform, scheduled_at, status FROM contents WHERE status IN ('ready_to_publish','scheduled') "
                  "AND scheduled_at<=? ORDER BY scheduled_at", (day_end,))
    for c in pub:
        add(2, "publication", f"Publier « {c['title']} » sur {c['platform']}", f"créneau {c['scheduled_at']} · étiquette IA de la plateforme à activer",
            f"#/studio?c={c['id']}")
    j1 = db.rows("SELECT c.id, c.title FROM contents c WHERE c.status='published' AND c.published_at<=? "
                 "AND NOT EXISTS (SELECT 1 FROM metrics m WHERE m.content_id=c.id)", (db.now(-86400),))
    j7 = db.rows("SELECT c.id, c.title FROM contents c WHERE c.status='published' AND c.published_at<=? AND "
                 "(SELECT MAX(date) FROM metrics m WHERE m.content_id=c.id) < substr(c.published_at,1,10)", (db.now(-7 * 86400),))
    j7 = [c for c in j7 if c["id"] not in {x["id"] for x in j1}]
    add(3, "stats", f"Saisir les stats J+1 de {len(j1)} contenu(s)", "vues, interactions, durée moyenne : c'est ce qui nourrit le moteur", "#/analytics", len(j1))
    add(3, "stats", f"Saisir les stats J+7 de {len(j7)} contenu(s)", "", "#/analytics", len(j7))
    human = db.scalar("SELECT COUNT(*) FROM messages WHERE status='needs_human'")
    drafted = db.scalar("SELECT COUNT(*) FROM messages WHERE status='drafted'")
    add(3, "communauté", f"Traiter {human} message(s) sensibles", "", "#/community", human)
    add(4, "communauté", f"Envoyer {drafted} réponse(s) préparées", "copier-coller depuis Community", "#/community", drafted)
    add(3, "corrections", f"Revoir {len(rev)} contenu(s) bloqué(s) par le QC", "", "#/studio", len(rev))
    for c in db.rows("SELECT id, name, stage, next_action_at FROM collabs WHERE next_action_at IS NOT NULL AND next_action_at<=? "
                     "AND stage NOT IN ('done','declined')", (day_end[:10],)):
        add(4, "partenariat", f"Relancer {c['name']} ({c['stage']})", "", "#/growth")
    for c in db.rows("SELECT name, due_date FROM collabs WHERE kind='brand' AND paid=0 AND due_date IS NOT NULL AND due_date<=?", (day_end[:10],)):
        add(3, "partenariat", f"Échéance deal {c['name']} ({c['due_date']})", "livrables publiés ? paiement reçu ?", "#/finance")
    cc = len(claude_code.list_tasks())
    add(2, "agents", f"{cc} tâche(s) d'agents en attente : ouvre Claude Code et tape /agency-run-tasks", "", "#/daily", cc)
    failed = db.scalar("SELECT COUNT(*) FROM jobs WHERE status IN ('failed','dead') AND updated_at>=?", (db.now(-86400),))
    add(4, "technique", f"{failed} tâche(s) en échec à relancer", "", "#/agents", failed)
    if not db.scalar("SELECT COUNT(*) FROM accounts"):
        add(4, "configuration", "Ajouter tes comptes officiels (page Comptes)", "active les quotas et la veille santé", "#/accounts")
    return sorted(items, key=lambda i: i["priority"])


def write_todo() -> Path:
    tz = ZoneInfo(load_env().timezone)
    d = datetime.now(timezone.utc).astimezone(tz).date().isoformat()
    items = build_todo()
    labels = {1: "Urgent", 2: "Aujourd'hui", 3: "Important", 4: "Quand tu peux"}
    L = [f"# To-do du {d}", "", f"{len(items)} action(s). Tout le reste, les agents s'en occupent.", ""]
    for p in (1, 2, 3, 4):
        sub = [i for i in items if i["priority"] == p]
        if sub:
            L += [f"## {labels[p]}"] + [f"- [ ] {i['title']}" + (f" — {i['detail']}" if i["detail"] else "") for i in sub] + [""]
    BRIEFS_DIR.mkdir(exist_ok=True)
    path = BRIEFS_DIR / f"todo-{d}.md"
    path.write_text("\n".join(L), encoding="utf-8")
    return path
