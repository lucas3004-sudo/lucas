# Design system — ImmoPilot AI

- **Date** : 20 novembre 2026, phase 3
- **Choix** : le fondateur a demandé de construire directement, sans maquette préalable, avec un style moderne et sobre.
- **Captures** : voir `docs/captures/` (bureau, thème sombre, mobile).

## Principes
1. **Sobre et dense en information.** Pas de cartes décoratives : chaque bloc affiche une donnée réelle ou une action réelle.
2. **Aucun bouton sans action.** La navigation ne montre que les modules construits et testés. Les modules à venir apparaissent seulement comme une liste de texte, sans lien.
3. **Lisibilité des chiffres.** Police Inter, chiffres à largeur fixe (`.tabular`) dans les tableaux et indicateurs.
4. **Accessibilité.** Contrastes suffisants dans les deux thèmes, focus visible, libellés sur tous les champs, navigation au clavier, `aria-current` sur la page active.
5. **Thème sombre automatique**, selon le réglage de l'appareil.

## Jetons (`apps/web/src/app/globals.css`)

| Jeton | Rôle | Clair | Sombre |
|---|---|---|---|
| `canvas` | Fond de page | #f4f5f8 | #0b0f17 |
| `surface` | Cartes, panneaux | #ffffff | #121826 |
| `line` / `line-strong` | Bordures | #e2e6ec / #c9d0da | #232c3d / #344057 |
| `ink` / `ink-muted` / `ink-subtle` | Texte principal, secondaire, discret | #111827 / #556074 / #626b7e | #e8ecf3 / #a3adbf / #8390a6 |
| `brand` | Bleu marine (actions principales) | #17325c | #3d6fc4 |
| `success` / `warning` / `danger` | États | vert / ambre / rouge, chacun avec une variante `-soft` pour les fonds | — |

- **Rayons** : cartes 12 px, contrôles 8 px.
- **Ombres** : très légères (`--shadow-card`).
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
