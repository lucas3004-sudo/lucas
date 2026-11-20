#!/usr/bin/env bash
# ImmoPilot AI — base PostgreSQL + PostGIS de développement.
#
# Usage : ./scripts/dev-db.sh start | stop | reset | status
#
# Deux modes, choisis automatiquement :
#   - Docker disponible : conteneur postgis/postgis (docker-compose.yml) ;
#   - sinon : binaires PostgreSQL locaux (16+, avec PostGIS), lancés sous l'utilisateur
#     système « postgres » (exécuter en root).
# Crée les bases « immopilot » (développement) et « immopilot_test » (tests d'intégration),
# les rôles applicatifs, puis applique les migrations.
# Les mots de passe ci-dessous ne servent QU'EN LOCAL (voir .env.example).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${DB_PORT:-54320}"
DIR="${DEV_DB_DIR:-/var/lib/postgresql/immopilot-dev}"
PW_OWNER=dev_owner PW_USER=dev_user PW_AUTH=dev_auth PW_INGEST=dev_ingest

use_docker() { command -v docker >/dev/null && docker info >/dev/null 2>&1; }
pgbin() { ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1; }
as_pg() { runuser -u postgres -- "$@"; }

psql_super() {
  if use_docker; then
    docker compose -f "$ROOT/docker-compose.yml" exec -T db psql -U postgres "$@"
  else
    as_pg "$(pgbin)/psql" -h 127.0.0.1 -p "$PORT" -U postgres "$@"
  fi
}

bootstrap() {
  for db in immopilot immopilot_test; do
    psql_super -q -d postgres -v owner_pw="$PW_OWNER" -v user_pw="$PW_USER" -v auth_pw="$PW_AUTH" \
      -v ingest_pw="$PW_INGEST" -v dbname="$db" < "$ROOT/scripts/db-bootstrap.sql"
    DATABASE_URL_OWNER="postgres://app_owner:$PW_OWNER@127.0.0.1:$PORT/$db" \
      pnpm --dir "$ROOT" --silent db:migrate
  done
}

start() {
  if use_docker; then
    docker compose -f "$ROOT/docker-compose.yml" up -d --wait db
  else
    local bin; bin="$(pgbin)"
    [[ -x "$bin/postgres" ]] || { echo "PostgreSQL introuvable : installez postgresql-16 et postgresql-16-postgis-3, ou Docker."; exit 1; }
    if [[ ! -d "$DIR/data" ]]; then
      mkdir -p "$DIR"; chown postgres:postgres "$DIR"
      as_pg "$bin/initdb" -D "$DIR/data" -A trust -U postgres -E UTF8 --locale=C.UTF-8 >/dev/null
    fi
    if ! as_pg "$bin/pg_ctl" -D "$DIR/data" status >/dev/null 2>&1; then
      as_pg "$bin/pg_ctl" -D "$DIR/data" -l "$DIR/server.log" -w \
        -o "-p $PORT -k $DIR -c listen_addresses=127.0.0.1" start >/dev/null
    fi
  fi
  bootstrap
  echo "Base prête sur 127.0.0.1:$PORT (bases immopilot et immopilot_test)."
}

stop() {
  if use_docker; then docker compose -f "$ROOT/docker-compose.yml" down
  else as_pg "$(pgbin)/pg_ctl" -D "$DIR/data" -m fast stop >/dev/null 2>&1 || true; fi
}

case "${1:-}" in
  start) start ;;
  stop) stop; echo "Base arrêtée." ;;
  reset)
    stop
    if use_docker; then docker compose -f "$ROOT/docker-compose.yml" down -v; else rm -rf "$DIR"; fi
    start ;;
  status)
    if use_docker; then docker compose -f "$ROOT/docker-compose.yml" ps
    else as_pg "$(pgbin)/pg_ctl" -D "$DIR/data" status || true; fi ;;
  *) echo "Usage : $0 start | stop | reset | status"; exit 1 ;;
esac
