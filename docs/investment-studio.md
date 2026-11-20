# Investment Studio (critère F7)

Date : 2026-11-20 · Fait partie du choix du fondateur « CRM et matching d'abord ».

## Ce que fait l'écran
- **Hypothèses**, toutes modifiables et affichées :
  - achat : prix, frais d'acquisition en %, honoraires, travaux, mobilier ;
  - location : loyer hors charges, vacance en mois par an, gestion locative en % ;
  - charges annuelles : taxe foncière, copropriété non récupérable, assurance propriétaire, entretien ;
  - financement : apport, taux, durée, assurance emprunteur.
- **Résultats** :
  - rendement brut et rendement net de charges ;
  - cash-flow mensuel et annuel ;
  - coût total d'acquisition, montant emprunté, mensualité, assurance, coût total des intérêts.
- **Sensibilité** : un tableau de 5 × 5 montre le cash-flow et le rendement net quand le prix varie de −10 % à +10 % et le loyer de −10 % à +10 %. Les frais et l'emprunt suivent le prix ; l'apport reste fixe.
- **Accès** : depuis le menu, depuis un **bien de l'agence** (adresse et prix repris) et depuis un **dossier de bien** (adresse et repère de loyer ANIL).
- **Avertissement visible** : la simulation est indicative et calculée avant impôt. Ce n'est ni un conseil en investissement ni un conseil fiscal.

## Définitions retenues (D-035)
| Indicateur | Formule |
|---|---|
| Coût total | prix + frais d'acquisition + honoraires + travaux + mobilier |
| Rendement brut | loyer × 12 / coût total |
| Rendement net de charges | (loyers encaissés − charges) / coût total, avant impôt et hors crédit |
| Loyers encaissés | loyer × (12 − mois de vacance) |
| Gestion locative | % des loyers **encaissés** |
| Mensualité | prêt amortissable à mensualités constantes ; à taux zéro, capital / nombre de mois |
| Assurance emprunteur | % annuel du capital **initial**, divisé par 12 |
| Cash-flow mensuel | (loyers encaissés − charges) / 12 − mensualité − assurance |

## Précautions
- Le repère ANIL est un loyer d'annonce **charges comprises**. Il est affiché à titre indicatif et ne remplit **jamais** le champ « loyer hors charges ».
- Une valeur illisible ou hors limites est signalée et le calcul n'est pas lancé. Aucune valeur n'est corrigée en silence.
- La simulation n'est pas enregistrée en base : elle tient dans le lien de la page, qu'on peut copier. Elle ne contient aucune donnée personnelle.

## Tests
- **12 cas calculés à la main** (`packages/domain/src/invest/simulate.test.ts`). Ils couvrent : l'achat comptant, les frais, la vacance, les charges, la gestion, un prêt classique et un prêt à taux zéro, l'assurance, un scénario complet à crédit, un apport supérieur au coût, la sensibilité et les bornes. Les mensualités ont été recoupées avec un calcul indépendant.
- **4 tests de lecture des hypothèses** : nombres à la française, valeurs invalides, repère de loyer.
- **Bout en bout** : le scénario n° 9 saisi à l'écran affiche les mêmes chiffres (5,83 %, 4,49 %, −168 €/mois, mensualité de 792 €). Une durée de 45 ans est refusée. Le lien depuis un bien reprend son prix.

## Capture
[Investment Studio](captures/12-investment-studio.png)

## Pistes suivantes
- Enregistrer une simulation et la rattacher à un bien ou à un contact.
- Fiscalité (micro-foncier, réel, LMNP) : uniquement après validation par un expert-comptable, et toujours présentée comme une simulation.
