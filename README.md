# ImmoPilot AI

Plateforme immobilière intelligente et multi-agents pour les agents immobiliers, agences, investisseurs et particuliers.

**Statut** : phases 0 (audit) et 1 (stratégie) livrées. Aucune fonctionnalité applicative n'est encore livrée. Voir [PROGRESS.md](PROGRESS.md).

## Documentation
- [Audit et cadrage — phase 0](docs/phase-0-audit.md) : état des lieux, sources de données testées, architecture, organisation des agents, risques, roadmap.
- [Stratégie, prix et MVP — phase 1](docs/phase-1-strategie.md), avec les recherches associées dans [docs/research](docs/research) et la [fiche juridique](docs/legal/fiche-juridique.md).
- [Journal des décisions](docs/DECISIONS.md)
- [Progression](PROGRESS.md)

## Vérifier les sources de données publiques
```bash
./scripts/check-data-sources.sh
```
Le script interroge la BAN, l'API Géo, Géorisques, le DPE de l'ADEME, DVF et le cadastre. Il vérifie que chaque réponse contient bien la donnée attendue, et renvoie un code non nul si une source critique est indisponible.
