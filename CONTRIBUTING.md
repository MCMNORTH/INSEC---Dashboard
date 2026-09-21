# Contribuer à INSEC Dashboard

## Règles de travail

1. Ne travaillez pas directement sur `main`. Créez une branche courte depuis la dernière version de `main`.
2. Utilisez un nom explicite, par exemple `feature/admissions`, `fix/calcul-solde` ou `docs/deploiement`.
3. Limitez chaque pull request à un objectif cohérent et décrivez les risques éventuels.
4. N’ajoutez jamais de secrets, de données réelles d’étudiants, de base SQLite, de document administratif ou de sauvegarde.
5. Attendez la réussite de tous les contrôles GitHub et l’approbation du responsable avant la fusion.

## Vérifications locales obligatoires

```bash
php artisan test
npm run build
php artisan insec:check
```

Pour une modification de données, ajoutez une migration réversible. Pour une nouvelle règle métier, ajoutez au moins un test couvrant le comportement attendu et les accès interdits.

## Commits et pull requests

Préférez des messages courts et explicites :

- `feat: add student payment reminder`
- `fix: prevent duplicate enrollment`
- `test: cover finance role permissions`
- `docs: update recovery procedure`

Une pull request doit préciser son objectif, les vérifications réalisées, les risques et la procédure de retour arrière. Les conversations de revue doivent être résolues avant la fusion.
