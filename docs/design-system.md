# Design system — ImmoPilot AI

- **Date** : 20 novembre 2026, phase 3
- **Choix** : le fondateur a demandé de construire directement, sans maquette préalable, avec un style moderne et sobre.
- **Captures** : voir `docs/captures/` (bureau, thème sombre, mobile).
- **Refonte « heure dorée »** (D-058, D-059, 23 novembre 2026) : la page d'accueil et tout le logiciel partagent la même palette chaude, les mêmes polices et les mêmes animations.

## Principes
1. **Sobre et dense en information.** Pas de cartes décoratives : chaque bloc affiche une donnée réelle ou une action réelle.
2. **Aucun bouton sans action.** La navigation ne montre que les modules construits et testés. Les modules à venir apparaissent seulement comme une liste de texte, sans lien.
3. **Lisibilité des chiffres.** Police Inter pour le texte, chiffres à largeur fixe (`.tabular`) dans les tableaux et indicateurs. Titres en **Sora** (`font-display`), mots mis en valeur en **Instrument Serif italique** (`font-serif italic`).
4. **Accessibilité.** Contrastes suffisants dans les deux thèmes, focus visible, libellés sur tous les champs, navigation au clavier, `aria-current` sur la page active.
5. **Thème sombre automatique**, selon le réglage de l'appareil.
6. **Animations courtes et utiles.** Dans le logiciel, rien ne dépasse 350 ms : entrée de page en vague brève, pression des boutons, ouverture des menus, barres qui se remplissent. Les longues animations (scène qui défile, verre dépoli, bascule 3D) sont réservées à la page d'accueil. Tout est coupé si l'utilisateur réduit les mouvements.

## Jetons (`apps/web/src/app/globals.css`)

| Jeton | Rôle | Clair | Sombre |
|---|---|---|---|
| `canvas` | Fond de page (avec une lueur chaude très légère en haut) | #f6f1eb | #0f0a08 |
| `surface` / `surface-muted` | Cartes, panneaux | #fffcf9 / #f1e9e0 | #18120f / #221a16 |
| `line` / `line-strong` | Bordures | #e8dfd5 / #d6c8ba | #2e2520 / #43372f |
| `ink` / `ink-muted` / `ink-subtle` | Texte principal, secondaire, discret | #1c1411 / #66574f / #6e5f57 | #f6eee8 / #bcaea5 / #a99b93 |
| `brand` / `brand-text` | Terre cuite (accents, liens, éléments actifs) | #b13f20 / #9c361a | #f0896b / #ffab8f |
| `success` / `warning` / `danger` | États | vert / ambre / rouge, chacun avec une variante `-soft` pour les fonds | — |

- **Zone « nuit »** (classe `.night`) : mêmes jetons en valeurs sombres, quel que soit le thème. Utilisée pour la barre latérale, le menu mobile et la formule mise en avant.
- **Boutons** : en pilule ; le bouton principal est à l'encre (sombre en thème clair, clair en thème sombre).
- **Contrastes** : tous les couples texte/fond dépassent 4,5:1 (calculés, puis vérifiés par l'audit axe-core en CI).
- **Rayons** : cartes 20 px, contrôles 12 px, boutons en pilule.
- **Ombres** : douces et chaudes (`--shadow-card`, `--shadow-pop`).
- **Règle** : les composants n'utilisent que ces jetons, jamais de couleur en dur. Seul le panneau de marque de la page de connexion utilise une couleur fixe.

## Composants (`apps/web/src/ui/`)
- `Button`, `LinkButton`, `buttonClass` : variantes `primary`, `secondary`, `ghost`, `danger` ; tailles `sm` et `md`.
- `Input`, `Select`, `Field` : libellé, aide, champ.
- `Card`, `CardHeader`, `CardBody`, `PageHeader`, `Badge`, `Alert`.
- `SubmitButton` (état d'envoi), `CopyField` (lien à copier) : composants côté navigateur.
- `Logo`, `LogoMark` : un toit dont l'intérieur forme une flèche de navigation (« pilote »).

## À venir
- Composant de **provenance des données** (valeur, statut vérifiée / déclarée / estimée / hypothèse / manquante, source et date), en phase 4.
- Tableaux de données triables, graphiques (selon les règles de visualisation), en phase 4.
