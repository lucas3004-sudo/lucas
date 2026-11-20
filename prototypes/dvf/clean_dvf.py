"""ImmoPilot AI — prototype des règles de nettoyage DVF (référence pour la phase 4).

Usage : python3 -I prototypes/dvf/clean_dvf.py <fichier_dvf_commune.csv>

Le fichier est un CSV « DVF géolocalisées » (Etalab), une ligne par local × parcelle × culture.
Le script compare une approche naïve (une ligne = une vente) aux règles retenues,
et affiche l'effet de chaque règle. Bibliothèque standard uniquement.

Règles (identifiants repris dans docs/phase-2/ingestion.md) :
  R1  Nature : « Vente » (ancien) et « Vente en l'état futur d'achèvement » (neuf, à part).
      Exclues : adjudication, échange, terrain à bâtir, expropriation…
  R2  Regroupement par id_mutation ; dédoublonnage des locaux répétés sur plusieurs lignes.
  R3  Composition : exactement 1 logement (appartement OU maison), avec 0 à n dépendances,
      aucun local commercial ou industriel.
  R4  Surface bâtie du logement ≥ 9 m² et valeur foncière > 0.
  R5  Valeurs extrêmes : prix au m² hors de [200 ; 25 000] € ou hors de
      [Q1 − 3·IQR ; Q3 + 3·IQR] par type de logement et par nature (ancien / neuf).
"""
import csv
import statistics
import sys
from collections import Counter, defaultdict

NATURES = {"Vente": "ancien", "Vente en l'état futur d'achèvement": "neuf"}
LOGEMENTS = {"Appartement", "Maison"}
BORNES_ABSOLUES = (200.0, 25000.0)


def to_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def quartiles(values):
    q = statistics.quantiles(values, n=4, method="inclusive")
    return q[0], q[1], q[2]


def describe(label, values):
    if not values:
        return f"{label:<44} n=0"
    q1, med, q3 = quartiles(values) if len(values) >= 4 else (min(values), statistics.median(values), max(values))
    return f"{label:<44} n={len(values):>5}  médiane={med:>7.0f} €/m²  Q1–Q3={q1:.0f}–{q3:.0f}"


def main(path):
    with open(path, encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))

    # Approche naïve : chaque ligne « Vente » d'appartement ou de maison avec surface = une vente.
    naive = defaultdict(list)
    for r in rows:
        s, v = to_float(r["surface_reelle_bati"]), to_float(r["valeur_fonciere"])
        if r["nature_mutation"] == "Vente" and r["type_local"] in LOGEMENTS and s and s >= 9 and v:
            naive[r["type_local"]].append(v / s)

    mutations = defaultdict(list)
    for r in rows:
        mutations[r["id_mutation"]].append(r)

    exclusions = Counter()
    retenues = []  # (type, nature, prix_m2, surface, pieces, terrain)
    for mid, lines in mutations.items():
        first = lines[0]
        nature = NATURES.get(first["nature_mutation"])
        if nature is None:
            exclusions["R1 nature exclue"] += 1
            continue
        # R2 : un local = (type, surface, pièces, parcelle, lot) ; les lignes répétées sont fusionnées.
        locaux = {
            (r["type_local"], r["surface_reelle_bati"], r["nombre_pieces_principales"], r["id_parcelle"], r["lot1_numero"])
            for r in lines if r["type_local"]
        }
        types = Counter(l[0] for l in locaux)
        nb_logements = types["Appartement"] + types["Maison"]
        autres = sum(n for t, n in types.items() if t not in LOGEMENTS and t != "Dépendance")
        if nb_logements != 1 or autres:
            exclusions["R3 composition (0 ou plusieurs logements, ou local commercial)"] += 1
            continue
        logement = next(l for l in locaux if l[0] in LOGEMENTS)
        surface, valeur = to_float(logement[1]), to_float(first["valeur_fonciere"])
        if not surface or surface < 9 or not valeur or valeur <= 0:
            exclusions["R4 surface < 9 m² ou valeur absente"] += 1
            continue
        # Terrain : une surface par couple (parcelle, nature de culture), sans double compte.
        parcelles = {(r["id_parcelle"], r["nature_culture"]): r["surface_terrain"] for r in lines}
        terrain = sum(to_float(s) or 0 for s in parcelles.values())
        retenues.append((logement[0], nature, valeur / surface, surface, logement[2], terrain))

    # R5 : valeurs extrêmes, par groupe (type × nature).
    groupes = defaultdict(list)
    for t, n, p, *_ in retenues:
        groupes[(t, n)].append(p)
    finales = defaultdict(list)
    for (t, n), prix in groupes.items():
        if len(prix) >= 8:
            q1, _, q3 = quartiles(prix)
            bas, haut = max(BORNES_ABSOLUES[0], q1 - 3 * (q3 - q1)), min(BORNES_ABSOLUES[1], q3 + 3 * (q3 - q1))
        else:
            bas, haut = BORNES_ABSOLUES
        for p in prix:
            if bas <= p <= haut:
                finales[(t, n)].append(p)
            else:
                exclusions["R5 prix au m² extrême"] += 1

    print(f"Fichier : {path}")
    print(f"Lignes : {len(rows)} — mutations : {len(mutations)}")
    print("\nApproche naïve (une ligne = une vente) :")
    for t in sorted(naive):
        print("  " + describe(f"{t}", naive[t]))
    print("\nExclusions par règle (en nombre de mutations) :")
    for regle, n in sorted(exclusions.items()):
        print(f"  {regle:<66} {n:>5}")
    print("\nAprès nettoyage (R1 à R5) :")
    for (t, n) in sorted(finales):
        print("  " + describe(f"{t} — {n}", finales[(t, n)]))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
