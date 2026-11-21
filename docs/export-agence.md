# Export complet des données de l'agence (réversibilité)

« Vos données vous appartiennent. » Le gérant peut récupérer à tout moment toutes les données de l'agence. Il en a besoin pour changer d'outil, archiver, ou répondre à une demande RGPD. C'est aussi un argument de confiance à la vente.

## Ce qui est construit
- **Paramètres → « Exporter les données de l'agence »**, avec un fichier CSV par type :
  - contacts ;
  - biens de l'agence ;
  - profils de recherche ;
  - consentements (avec leur preuve) ;
  - tâches ;
  - rendez-vous ;
  - affaires ;
  - comptes rendus de visite.
- **Format Excel (France)** :
  - UTF-8 avec marque d'ordre des octets (BOM), pour que les accents s'affichent ;
  - point-virgule, virgule décimale, dates au format JJ/MM/AAAA ;
  - les colonnes des contacts et des biens reprennent celles de l'import : on peut ré-importer un export.
- **Sécurité** :
  - réservé au **gérant**, avec la **double authentification active**. Un export complet est la première cible d'un compte volé ou d'un départ mal préparé ;
  - chaque export est inscrit au journal d'audit, avec le type et le nombre de lignes seulement, sans donnée personnelle ;
  - protection contre l'**injection de formules** : une cellule de texte qui commence par `=`, `+`, `-`, `@`, une tabulation ou un retour chariot est préfixée d'une apostrophe, pour qu'Excel ne l'exécute pas (recommandation OWASP) ;
  - liste fermée des types (inconnu → 404) et aucune mise en cache (`no-store`).
- Lecture sous l'identité du gérant : les règles d'accès de la base s'appliquent (le gérant voit toute l'agence).

## Tests
- 2 tests unitaires du format CSV : guillemets, retours à la ligne, nombres français, relecture par notre propre lecteur, formules neutralisées.
- 1 scénario de bout en bout :
  - refus sans double authentification ;
  - activation ;
  - téléchargement, avec vérification du BOM, de l'en-tête, de la ligne du contact et de la formule neutralisée ;
  - les 8 types répondent ;
  - un type inconnu donne 404 ;
  - le journal ne contient pas l'e-mail du contact.
- Le scénario « équipe » vérifie qu'un négociateur n'a ni la carte, ni l'accès direct (403).

## Limites
- Les photos des biens ne sont pas incluses : il faudra une archive ZIP, à faire avec le stockage d'objets (D-042).
- Les dossiers de biens (instantanés DVF) ne sont pas exportés en CSV, car ils sont déjà imprimables en PDF.
