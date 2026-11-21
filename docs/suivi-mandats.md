# Suivi des mandats (F5)

Ne pas laisser expirer un mandat sans le voir. Le logiciel enregistre, pour chaque bien, le type de mandat, son numéro et ses dates, puis prévient avant la fin.

**Ce n'est pas le registre des mandats** prévu par la loi Hoguet. L'agence garde son registre officiel, et la validité d'un registre électronique est une question posée à l'avocat (fiche juridique, question n° 10).

## Ce qui est construit
- **Fiche du bien, carte « Mandat »** : type (simple ou exclusif), numéro, date de signature, date de fin. Elle se modifie par le responsable du bien, le gérant ou les managers (droits du bien).
- **Contrôles en base** (migration 0019) :
  - un numéro ne sert qu'une fois par agence, même sur un bien privé d'un collègue ;
  - une autre agence peut utiliser le même numéro ;
  - la date de fin suit la date de signature.
- **Rappels** (`packages/domain/src/mandates/expiry.ts`) :
  - à partir de 30 jours avant la fin, un badge apparaît sur la fiche du bien et l'élément s'affiche dans « Ma journée » (« Mandats à renouveler », pour les biens dont on est responsable) ;
  - après la fin, la fiche affiche « Mandat expiré depuis N jour(s) », et le bien apparaît dans « Qualité des données » (« Mandats expirés »), donc aussi dans l'agent Qualité des données ;
  - seuls les biens « Sous mandat » ou « Sous offre » sont concernés.
- **Agent « Veille des mandats »** (Agent Center, sans IA, niveau L1) : il crée une tâche « Mandat à renouveler » pour le responsable de chaque bien concerné, sans doublon. Il ne modifie jamais le mandat.
- **Aucun délai légal calculé** (irrévocabilité d'un exclusif, préavis de résiliation) : ces règles dépendent du contrat signé. Seule la date saisie par l'agence fait foi.
- **Import CSV des biens** :
  - nouvelles colonnes « N° mandat », « Date de mandat » et « Fin du mandat » (JJ/MM/AAAA ou AAAA-MM-JJ) ;
  - les dates impossibles (31/02) et les formats américains sont refusés ligne par ligne ;
  - un numéro déjà utilisé, dans l'agence ou dans le fichier, est signalé dès l'aperçu ;
  - si le numéro est porté par un bien que l'utilisateur ne voit pas, l'import entier est annulé avec un message clair.
- **Journal d'audit** : « Mandat d'un bien modifié », avec l'identifiant du bien seulement.

## Tests
- 4 tests unitaires : seuils de 30 jours, mandat expiré, statuts ignorés, changement d'heure, libellés.
- 2 tests unitaires sur l'import : colonnes du mandat, dates françaises et dates inexistantes.
- 2 tests unitaires sur la lecture des dates PostgreSQL, vérifiée dans trois fuseaux horaires, sans décalage d'un jour.
- 2 tests d'intégration : unicité du numéro par agence et entre agences ; dates cohérentes et droits de modification.
- Le scénario d'import de bout en bout vérifie qu'un mandat importé déclenche le rappel.
- 1 scénario de bout en bout : mandat à 10 jours de la fin dans « Ma journée », dates incohérentes refusées, numéro en double refusé, mandat expiré dans « Qualité des données », journal.

## Limites
- Pas de rappel par e-mail : il faudra le service d'e-mail (Brevo, en attente).
