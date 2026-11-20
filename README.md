# ImmoPilot AI

Plateforme immobilière intelligente et multi-agents pour les agents immobiliers, agences, investisseurs et particuliers.

**Statut** : phases 0 (audit), 1 (stratégie) et 2 (architecture) livrées. Aucune fonctionnalité applicative n'est encore livrée. Voir [PROGRESS.md](PROGRESS.md).

## Documentation
- [Audit et cadrage — phase 0](docs/phase-0-audit.md) : état des lieux, sources de données testées, architecture, organisation des agents, risques, roadmap.
- [Stratégie, prix et MVP — phase 1](docs/phase-1-strategie.md), avec les recherches associées dans [docs/research](docs/research) et la [fiche juridique](docs/legal/fiche-juridique.md).
- [Architecture détaillée — phase 2](docs/phase-2/architecture.md) : modèle de données, permissions, moteur d'agents, ingestion.
- [Journal des décisions](docs/DECISIONS.md)

## Développement

Prérequis : Node.js 22, pnpm 10, et soit Docker, soit PostgreSQL 16 avec PostGIS installé localement.

```bash
pnpm install
```

```bash
pnpm db:start
```

```bash
cp .env.example apps/web/.env.local
```

Renseignez `BETTER_AUTH_SECRET` dans `apps/web/.env.local` (par exemple avec `openssl rand -base64 32`), puis lancez l'application :

```bash
pnpm dev
```

L'application tourne sur http://localhost:3000.

Vérifications (les mêmes que la CI) :

```bash
pnpm lint && pnpm typecheck && pnpm test
```

```bash
pnpm test:integration
```

```bash
pnpm build && pnpm --filter @immopilot/web test:e2e
```

## Prototypes de validation
```bash
sudo ./prototypes/rls/run.sh                               # isolation entre agences (PostgreSQL 16 requis)
python3 -I prototypes/dvf/clean_dvf.py <fichier_dvf.csv>   # règles de nettoyage DVF
```
- [Progression](PROGRESS.md)

## Vérifier les sources de données publiques
```bash
./scripts/check-data-sources.sh
```
Le script interroge la BAN, l'API Géo, Géorisques, le DPE de l'ADEME, DVF et le cadastre. Il vérifie que chaque réponse contient bien la donnée attendue, et renvoie un code non nul si une source critique est indisponible.
