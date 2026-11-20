# Déploiement

## Local (PC)
```bash
python3 -m venv .venv && .venv/bin/pip install -e ".[api,dev]"   # ou: uv venv && uv pip install -e ".[api,dev]"
cp .env.example .env                                                # puis renseigner les clés utiles
.venv/bin/python -m agency serve                                    # http://127.0.0.1:8000
```
Prérequis : Python ≥ 3.11, ffmpeg (Windows : `winget install ffmpeg` ; macOS : `brew install ffmpeg`).

## Docker (local ou serveur)
```bash
cp .env.example .env && echo "AGENCY_ADMIN_TOKEN=$(openssl rand -hex 24)" >> .env
docker compose up -d --build        # api (port 8000) + worker + scheduler, données dans ./data
```

## Fonctionner sans votre ordinateur (cloud)
L'agence tourne 24 h/24 sur n'importe quel serveur Docker (VPS, Railway, Fly.io…). Points à respecter :
1. `AGENCY_ADMIN_TOKEN` **obligatoire**, `AGENCY_ALLOWED_HOSTS=votre-domaine`, HTTPS via le proxy de l'hébergeur (ou Caddy).
2. Volume persistant pour `./data` (base + médias) ; sauvegarde quotidienne de `data/agency.db` (`sqlite3 data/agency.db ".backup backup.db"`).
3. Mode LLM : `offline` (gratuit) ou `api` (clé + plafonds). Le mode `claude_code` nécessite une session Claude Code ouverte : il ne fonctionne pas seul dans le cloud.
4. Le rapport quotidien est écrit dans `briefs/` (monter le dossier en volume pour le récupérer).
5. Montée en charge : remplacer SQLite par Postgres (SQL portable) et `storage.py` par S3/R2.

Aucune infrastructure cloud n'a été créée : ce choix (hébergeur, coût) vous revient.
