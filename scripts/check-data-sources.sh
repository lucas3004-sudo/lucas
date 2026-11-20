#!/usr/bin/env bash
# ImmoPilot AI — Vérification des sources de données publiques.
#
# Interroge chaque source avec une requête minimale et contrôle que la réponse
# contient bien la donnée attendue (pas seulement un HTTP 200).
# Usage : ./scripts/check-data-sources.sh
# Code de sortie : 0 si toutes les sources critiques répondent, 1 sinon.
#
# Adresse témoin : 8 boulevard du Port, 80000 Amiens (exemple public de la doc BAN).
set -uo pipefail

TIMEOUT=30
FAILED_CRITICAL=0
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

printf "Vérification des sources — %s\n\n" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
printf "%-34s %-9s %-6s %-8s %s\n" "SOURCE" "CRITIQUE" "HTTP" "TEMPS" "RÉSULTAT"

# check <nom> <critique:oui|non> <url> <motif attendu dans la réponse>
check() {
  local name="$1" critical="$2" url="$3" pattern="$4"
  local out="$TMP/body" meta code time status
  meta=$(curl -sS -L -o "$out" -w "%{http_code} %{time_total}" --max-time "$TIMEOUT" "$url" 2>"$TMP/err") || true
  code="${meta%% *}"; time="${meta##* }"
  if [[ "$code" == "200" ]] && grep -qE "$pattern" "$out" 2>/dev/null; then
    status="OK"
  else
    status="ÉCHEC $(tr '\n' ' ' < "$TMP/err" | cut -c1-70)"
    [[ "$critical" == "oui" ]] && FAILED_CRITICAL=1
  fi
  printf "%-34s %-9s %-6s %-8s %s\n" "$name" "$critical" "${code:-000}" "${time:-?}s" "$status"
}

# Le fichier DVF national fait ~50 Mo : on ne lit que les premiers octets
# compressés pour vérifier l'en-tête CSV, sans tout télécharger.
check_dvf_national() {
  local url="$1" header
  header=$(curl -sS -r 0-8191 --max-time "$TIMEOUT" "$url" 2>"$TMP/err" | gzip -dc 2>/dev/null | head -1)
  if [[ "$header" == id_mutation,date_mutation* ]]; then
    printf "%-34s %-9s %-6s %-8s %s\n" "DVF national (static.data.gouv)" "oui" "206" "-" "OK (en-tête CSV lu)"
  else
    printf "%-34s %-9s %-6s %-8s %s\n" "DVF national (static.data.gouv)" "oui" "?" "-" "ÉCHEC $(tr '\n' ' ' < "$TMP/err" | cut -c1-70)"
    FAILED_CRITICAL=1
  fi
}

check "BAN géocodage (Géoplateforme)" oui \
  "https://data.geopf.fr/geocodage/search?q=8+bd+du+port+amiens&limit=1" '"citycode":"80021"'
check "API Géo (communes)" oui \
  "https://geo.api.gouv.fr/communes?codePostal=80000&fields=nom,code" '"code":"80021"'
check "Géorisques GASPAR" oui \
  "https://georisques.gouv.fr/api/v1/gaspar/risques?code_insee=80021" '"risques_detail"'
check "Géorisques rapport par adresse" oui \
  "https://georisques.gouv.fr/api/v1/resultats_rapport_risque?latlon=2.290084,49.897442" '"risquesNaturels"'
check "ADEME DPE logements existants" oui \
  "https://data.ademe.fr/data-fair/api/v1/datasets/dpe03existant/lines?size=1&qs=code_postal_ban:80000" '"total"'
check "DVF métadonnées (data.gouv)" oui \
  "https://www.data.gouv.fr/api/1/datasets/demandes-de-valeurs-foncieres-geolocalisees/" '"resources"'
check "API Carto cadastre (IGN)" non \
  "https://apicarto.ign.fr/api/cadastre/parcelle?code_insee=80021&section=AB&_limit=1" '"FeatureCollection"'
check "DVF par commune (archive)" non \
  "https://files.data.gouv.fr/geo-dvf/latest/csv/2025/communes/80/80021.csv" '^id_mutation'
check "Cerema DVF+ (préprod)" non \
  "https://apidf-preprod.cerema.fr/dvf_opendata/mutations/?code_insee=80021&page_size=1" '"results"'

# URL résolue dynamiquement depuis les métadonnées data.gouv : elle change à chaque livraison.
DVF_URL=$(curl -sS --max-time "$TIMEOUT" "https://www.data.gouv.fr/api/1/datasets/demandes-de-valeurs-foncieres-geolocalisees/" 2>/dev/null \
  | python3 -I -c "import sys,json; r=[x['url'] for x in json.load(sys.stdin)['resources'] if x['url'].endswith('.csv.gz') and 'full-' in x['url']]; print(sorted(r)[-1] if r else '')" 2>/dev/null)
if [[ -n "$DVF_URL" ]]; then check_dvf_national "$DVF_URL"; else
  printf "%-34s %-9s %-6s %-8s %s\n" "DVF national (static.data.gouv)" "oui" "?" "-" "ÉCHEC URL introuvable dans les métadonnées"
  FAILED_CRITICAL=1
fi

echo
if [[ $FAILED_CRITICAL -eq 0 ]]; then echo "Toutes les sources critiques répondent."; else echo "Au moins une source critique est indisponible."; fi
exit $FAILED_CRITICAL
