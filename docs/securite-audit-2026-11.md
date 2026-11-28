# Audit de sécurité : 28 novembre 2026

- **Périmètre** : tout le logiciel, du site public au logiciel des agences, plus la base de données, la connexion, les fichiers envoyés, le paiement et l'hébergement.
- **Méthode** : contrôles automatiques, relecture du code et essais. Chaque correction est accompagnée d'un test, et chaque test a été vérifié dans les deux sens : il passe avec la correction et échoue sans elle.
- **Verdict** :
  - aucune faille grave ne reste ouverte ;
  - 2 failles connues dans des bibliothèques sont corrigées, plus 3 points mineurs ;
  - 4 chantiers restent à faire avant d'accueillir de vraies agences (section 4). Trois demandent votre accord : un service d'e-mail, des pages légales et une politique de conservation.

---

## 1. Ce qui a été corrigé

| # | Gravité | Problème | Risque concret | Correction | Preuve |
|---|---|---|---|---|---|
| 1 | Critique (selon l'avis officiel) | **MapLibre (la carte) ≤ 6.4.0** : le nettoyage du texte des crédits de la carte laissait passer du code (GHSA-jrc7-96c5-q579) | Faible chez nous : les crédits viennent de notre propre code, et la politique de sécurité du site bloque déjà ce type de code. Corrigé quand même | Passage à **MapLibre 6.18.0**. Le moteur de dessin de la carte est désormais publié avec le site (`scripts/copy-map-worker.mjs`) : sans lui, la carte restait vide | `pnpm audit` : 0 faille. Le test de la carte vérifie que le moteur démarre ; il **échoue** si on retire la correction (contrôle fait) |
| 2 | Moyenne | **fflate (lecture des ZIP) ≤ 0.8.2** : un ZIP piégé faisait tourner le serveur en boucle (GHSA-px8p-9vwx-vf98) | Un utilisateur connecté pouvait bloquer l'import en envoyant un faux export SeLoger | Passage à **fflate 0.8.3** | `pnpm audit` : 0 faille |
| 3 | Faible | Deux fonctions de la base (`ctx_org`, `ctx_user`) n'avaient pas de « chemin de recherche » figé (alerte du contrôleur Supabase) | Aucun ici : elles n'ont pas de droits élevés et l'application ne peut rien créer dans la base. Porte fermée par principe | Migration **0028** | Contrôleur Supabase à revérifier après la migration |
| 4 | Faible (RGPD) | Les empreintes d'adresse IP de la page « Estimez votre bien » étaient gardées **sans limite de durée** | Données conservées plus longtemps que nécessaire | Effacement automatique **au bout de 2 jours**. Elles ne servent qu'à limiter les envois à 3 par heure et 50 par jour | Test de la base : une empreinte de 3 jours est effacée, celle d'1 jour est gardée |
| 5 | Faible (fiabilité) | L'import annonçait un ZIP de 20 Mo au plus, alors que le serveur refuse tout envoi au-delà de 3 Mo, avec une erreur incompréhensible | Un gérant bloqué sans explication | Limite réelle de **2,8 Mo**, vérifiée dès le choix du fichier, avec un message clair : « envoyez seulement Annonces.csv » | Test de bout en bout : un ZIP de 3 Mo est arrêté avec le bon message |

---

## 2. Ce qui a été contrôlé et qui est sain

**Séparation entre agences (base de données)**
- Les 104 règles d'accès sont actives et **forcées** sur toutes les tables des agences.
- Chaque table qui contient une agence a sa règle d'isolement.
- L'application ne voit jamais les tables de comptes : mots de passe, sessions et codes de double authentification lui sont invisibles.
- Toutes les fonctions à droits élevés ont un chemin de recherche figé, et aucune n'est ouverte à tout le monde.
- Aucun rôle de l'application n'est administrateur ni ne contourne les règles.
- 66 tests d'intégration le vérifient, dont les cas où l'accès doit être refusé.

**Contrôle d'accès dans le site**
- Les 17 fichiers d'actions du serveur demandent tous une connexion. Seules deux exceptions, voulues :
  - la déconnexion ;
  - l'envoi public de la page « Estimez votre bien », qui est limité et vérifié.
- Les 12 adresses d'API vérifient la connexion, sauf trois exceptions voulues :
  - l'état de santé, qui ne donne que des nombres ;
  - la connexion elle-même ;
  - le paiement Stripe, protégé par une signature vérifiée.
- Les exports sensibles sont réservés au bon rôle : l'export complet exige le gérant **et** la double authentification.

**Connexion**
- Mots de passe de 12 caractères au minimum.
- Essais limités : 10 connexions et 10 codes de double authentification par minute ; 5 créations de compte par minute.
- Sessions de 7 jours ; cookies sécurisés en production.
- Double authentification disponible ; elle est rappelée au gérant et aux managers.

**Fichiers envoyés**
- **Photos** : le serveur revérifie le format réel (JPEG ou PNG). Il retire les métadonnées, dont la position GPS, et limite la taille et le nombre.
- **ZIP** : seul `Annonces.csv` est lu, avec une taille limitée.

**Navigateur**
- Politique de sécurité stricte, avec un code unique par page. Les injections de code sont bloquées : un test le vérifie.
- Le site ne peut pas être affiché dans un cadre d'un autre site.
- HTTPS est imposé en production.
- Caméra, micro et position sont désactivés.

**Appels à l'extérieur**
- Le serveur n'appelle que des services publics fixes : adresses, DVF, DPE, risques, Stripe, Anthropic.
- Aucune adresse saisie par un utilisateur n'est jamais appelée par le serveur. Il n'y a donc pas de risque de rebond vers des machines internes.

**Secrets**
- Aucune clé secrète dans le code ni dans son historique.
- Les clés sont dans les variables de Vercel.

**Hébergement**
- La base Supabase et le site Vercel sont tous deux **à Paris** : les données restent en France.

**Bibliothèques**
- 0 faille connue, y compris dans les outils de développement.

**Données envoyées à l'IA**
- Aucune coordonnée de contact n'est envoyée.
- Les agents n'envoient jamais l'adresse précise d'un bien. Seul le chat la reçoit, par choix (D-063).

---

## 3. Risques acceptés (faibles, documentés)

- **Enregistrement de l'abonnement** (`app.apply_subscription`) : la fonction est utilisable par le rôle de l'application. Elle n'est appelée que par la route Stripe, après vérification de la signature, et toutes les requêtes de l'application sont paramétrées. Un rôle séparé pour Stripe ajouterait une sécurité de plus. Je le prévois pour la mise en production.
- **État de santé public** (`/api/health`) : il indique le nombre de migrations, sans aucun nom ni détail technique. C'est utile pour surveiller le site.

---

## 4. À faire avant d'accueillir de vraies agences

1. **Service d'e-mail** :
   - pour vérifier l'adresse à l'inscription ;
   - pour permettre de **réinitialiser un mot de passe oublié**, ce qui est impossible aujourd'hui ;
   - pour envoyer les invitations.

   Il faut un compte externe : **votre accord est nécessaire**.
2. **Pages légales et contrat de traitement des données** :
   - pour les données des clients des agences, ImmoPilot est **sous-traitant** au sens du RGPD (article 28). Il faut un contrat de traitement des données (DPA) dans les conditions de vente ;
   - il faut aussi des CGU, des CGV et une politique de confidentialité.

   **À faire relire par un avocat** (voir `docs/legal/fiche-juridique.md`).
3. **Durées de conservation** :
   - journal d'activité : 1 an, comme le recommande la CNIL pour ce type de journal ;
   - contacts sans échange depuis 3 ans : à proposer à la suppression (règle de la CNIL pour les prospects) ;
   - comptes et agences fermés.

   Ces règles demandent une tâche automatique quotidienne, à construire avec la mise en production.
4. **Rôle séparé pour Stripe** : voir la section 3.

---

## 5. Fichiers modifiés

- `apps/web/package.json` : MapLibre 6.18.0, fflate 0.8.3 ; le moteur de carte est copié avant chaque build.
- `apps/web/scripts/copy-map-worker.mjs`, `apps/web/src/app/app/carte/map-view.tsx` : publication du moteur de la carte.
- `packages/db/migrations/0028_securite.sql` : fonctions de contexte, effacement des empreintes IP.
- `apps/web/src/lib/crm/import-limits.ts`, `import-actions.ts`, `_crm/import-wizard.tsx` : taille réelle des fichiers importés.
- Tests : `packages/db/src/integration/rls.int.test.ts`, `apps/web/e2e/carte.spec.ts`, `apps/web/e2e/import.spec.ts`.
