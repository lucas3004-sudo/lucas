#!/usr/bin/env bash
# ImmoPilot AI — exécute le prototype d'isolation RLS sur un PostgreSQL temporaire.
#
# Prérequis : PostgreSQL 16 installé localement (binaires dans /usr/lib/postgresql/<v>/bin),
# exécution en root (le serveur tourne sous l'utilisateur système « postgres »).
# Le cluster temporaire est supprimé à la fin.
# Usage : sudo ./prototypes/rls/run.sh [dossier_temporaire]
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
DIR="${1:-/var/lib/postgresql/immopilot-rls-proto}"
PORT=54329
PGBIN="$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)"
EXPECTED_OK=12

as_pg() { runuser -u postgres -- "$@"; }
cleanup() {
  as_pg "$PGBIN/pg_ctl" -D "$DIR/data" -m fast stop >/dev/null 2>&1 || true
  rm -rf "$DIR"
}

rm -rf "$DIR"; mkdir -p "$DIR"; chown postgres:postgres "$DIR"
trap cleanup EXIT
as_pg "$PGBIN/initdb" -D "$DIR/data" -A trust -U postgres >/dev/null
as_pg "$PGBIN/pg_ctl" -D "$DIR/data" -l "$DIR/server.log" -w \
  -o "-p $PORT -k $DIR -c listen_addresses=''" start >/dev/null

echo "PostgreSQL $(as_pg "$PGBIN/postgres" --version | awk '{print $3}') — schéma et données de test…"
as_pg "$PGBIN/psql" -h "$DIR" -p "$PORT" -U postgres -d postgres -q -v ON_ERROR_STOP=1 < "$HERE/schema.sql"

echo "Tests d'attaque avec le rôle applicatif (app_user) :"
OUT="$(as_pg "$PGBIN/psql" -h "$DIR" -p "$PORT" -U app_user -d postgres -q < "$HERE/tests.sql" 2>&1)"
echo "$OUT" | grep -E "OK T|ÉCHEC|ERROR" | sed -E 's/^(NOTICE|psql:[^ ]+ NOTICE): +/  /'
echo "Mesure (100 003 lignes, politiques actives) :"
echo "$OUT" | grep -E "InitPlan|Execution Time|Planning Time" | sed 's/^/  /'

OK=$(echo "$OUT" | grep -c "OK T" || true)
KO=$(echo "$OUT" | grep -cE "ÉCHEC|ERROR" || true)
echo
if [[ "$OK" -eq "$EXPECTED_OK" && "$KO" -eq 0 ]]; then
  echo "RÉSULTAT : $OK/$EXPECTED_OK tests réussis."
else
  echo "RÉSULTAT : $OK/$EXPECTED_OK réussis, $KO échec(s)."; exit 1
fi
