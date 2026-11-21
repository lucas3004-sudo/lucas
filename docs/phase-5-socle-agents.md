# Phase 5 (première partie) : socle des agents, sans IA

Date : 2026-11-21 · Choix du fondateur : « continuer sans IA ni compte ». Le socle est celui décrit dans `docs/phase-2/moteur-agents.md` ; les agents IA (modes « assisté » et « autonome ») s'y brancheront quand une clé Anthropic sera disponible.

## Ce qui est construit
- **Package `@immopilot/agents`** :
  - **fiches d'agents versionnées dans le code** : identifiant, version, mode, outils autorisés (liste fermée), niveau maximal, budget d'étapes ;
  - **passerelle d'outils**, seul chemin par lequel un agent agit. Elle refuse un outil absent de la fiche, un outil au-dessus du plafond, une entrée invalide et un dépassement du budget d'étapes ;
  - **à partir de L2**, elle n'exécute rien : elle crée une **demande d'approbation** ;
  - **exécuteur de missions** : mission réussie, échouée ou en attente d'approbation, avec un résumé sans donnée personnelle.
- **Migration 0014 (RLS)** :
  - activation des agents (gérant seulement) ;
  - missions (visibles par leur demandeur, le gérant et les managers) ;
  - étapes (ajout seul) ;
  - approbations : décidées par le gérant, un manager, ou le négociateur pour ses propres missions. Jamais au nom d'un autre, et une décision prise ne change plus.
- **Agents déterministes** (sans IA, coût mesuré : 0 €) :

| Agent | Outils | Niveau maximal | Ce qu'il fait |
|---|---|---|---|
| Qualité des données | `quality.report` | L0 | Compte les points à reprendre (consentements, doublons, annonces, biens, échéances…) |
| Opportunity Finder | `matching.missed`, `tasks.createMatchAlert` | L1 | Prévient les collègues des correspondances de 75 % ou plus pas encore signalées (identité jamais révélée) |
| Veille des échéances | `deals.deadlines`, `tasks.createReminder` | L1 | Crée une tâche de rappel pour chaque échéance d'affaire à 3 jours ou dépassée, sans doublon |
| Veille des mandats | `mandates.expiring`, `tasks.createMandateReminder` | L1 | Crée une tâche pour le responsable de chaque bien dont le mandat se termine dans 30 jours ou est expiré, sans doublon ; ne modifie jamais le mandat |
| Détection des doublons | `contacts.duplicates`, `contacts.merge` | **L2** | Propose la fusion des contacts en double. **Aucune fusion sans approbation** |

- **Agent Center** (`/app/agents`) : pour chaque agent, le statut, le mode, le niveau, les outils, la version, le coût mesuré et la dernière mission, avec les boutons « Lancer » et « Activer / Désactiver » (gérant). On y trouve aussi l'historique des missions.
- **Boîte d'approbations** (`/app/agents/approbations`) : le détail de chaque demande (pour une fusion, les deux fiches concernées), puis « Approuver » ou « Refuser ».
  - L'action approuvée s'exécute avec l'identité de celui qui l'approuve, dans la même transaction que la décision : une demande ne peut pas être exécutée deux fois.
  - Une demande expire après 7 jours.
- **Fusion de contacts** :
  - consentements recopiés avec leur date et leur preuve (ils sont en ajout seul) ;
  - profils, tâches, rendez-vous et affaires rattachés au contact conservé ;
  - coordonnées manquantes complétées, rôles réunis, notes ajoutées ;
  - doublon supprimé.
  Réservée au gérant et aux managers (D-044).

## Ce qui viendra avec l'IA (clé Anthropic nécessaire)
Modes « assisté » et « autonome », Copilot, rédaction d'annonces par IA, coûts mesurés en tokens, plafond de dépense, validateurs QA, travail de fond (worker).

## Tests
- 8 tests unitaires de la passerelle et des fiches : outil non autorisé, niveau trop élevé, budget, entrée invalide, L2 et L3 jamais exécutés, missions, et l'agent des doublons qui propose sans fusionner.
- 3 tests d'isolation : missions, étapes, approbations, activation.
- Bout en bout : deux fiches en double sont détectées ; la fusion n'a lieu qu'après approbation ; consentement et tâche sont repris ; les trois autres agents réussissent ; un agent désactivé ne peut plus être lancé ; tout est journalisé.
