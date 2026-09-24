# Contribuer à INSEC Dashboard

## Règles de travail

1. Ne travaillez pas directement sur `main`. Créez une branche courte depuis la dernière version de `main`.
2. Utilisez un nom explicite, par exemple `feature/admissions`, `fix/calcul-solde` ou `docs/deploiement`.
3. Limitez chaque pull request à un objectif cohérent et décrivez les risques éventuels.
4. N’ajoutez jamais de secrets, de données réelles d’étudiants, de document administratif ou de sauvegarde.
5. Attendez la réussite de tous les contrôles GitHub et l’approbation du responsable avant la fusion.

## Vérifications locales obligatoires

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

## Organisation du code

- `src/db/schema.ts` : schéma PostgreSQL. Après modification, générez la migration avec `npm run db:generate` et versionnez le fichier créé dans `drizzle/`.
- `src/lib/services/` : règles métier, indépendantes de Next.js et testées dans `tests/integration/`.
- `src/app/**/actions.ts` : Server Actions. Chacune commence par `contexte(ROLES, "route")` (ou `exigerConnexion()`), qui vérifie le rôle et alimente le journal d’audit.
- Les écritures sur les objets métier passent par `creer`, `modifier` et `supprimer` (`src/lib/audit.ts`) pour être tracées.

Pour une nouvelle règle métier, ajoutez au moins un test couvrant le comportement attendu et les accès interdits.

## Commits et pull requests

Préférez des messages courts et explicites :

- `feat: add student payment reminder`
- `fix: prevent duplicate enrollment`
- `test: cover finance role permissions`
- `docs: update recovery procedure`

Une pull request doit préciser son objectif, les vérifications réalisées, les risques et la procédure de retour arrière. Les conversations de revue doivent être résolues avant la fusion.
