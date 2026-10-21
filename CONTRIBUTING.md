# Contribuer à INSEC Dashboard

## Règles de travail

1. Ne travaillez pas directement sur `main`. Créez une branche courte depuis la dernière version de `main`.
2. Utilisez un nom explicite, par exemple `feat/relances`, `fix/calcul-solde` ou `docs/deploiement`.
3. Limitez chaque pull request à un objectif cohérent et décrivez les risques éventuels.
4. N’ajoutez jamais de secrets, de données réelles d’étudiants, d’export Firestore, de document administratif ou de sauvegarde.
5. Fusionnez uniquement quand les deux contrôles GitHub (« Firebase · Functions et règles » et « Front-end · Node.js 24 ») sont verts. Le projet est mené par une seule personne : aucune approbation tierce n’est exigée, mais relisez le résumé de la PR avant de fusionner.

## Vérifications locales obligatoires

```bash
npm test                              # fonctions et règles de sécurité, sur émulateurs
npm --prefix functions run typecheck
npm run build
```

Toute écriture de données passe par une Cloud Function : validez les entrées, utilisez une transaction et journalisez l’opération (`auditerModele`). Toute nouvelle requête Firestore combinant plusieurs champs doit avoir son index dans `firestore.indexes.json`, et toute nouvelle collection lisible depuis le navigateur doit être couverte par `firestore.rules` et par un test dans `functions/test/regles.test.ts`. Pour une nouvelle règle métier, ajoutez au moins un test couvrant le comportement attendu et les accès interdits.

## Commits et pull requests

Préférez des messages courts et explicites :

- `feat: ajouter les relances de paiement`
- `fix: empêcher une inscription en double`
- `test: couvrir les droits du rôle finance`
- `docs: mettre à jour la procédure de restauration`

Une pull request doit préciser son objectif, les vérifications réalisées, les risques et la procédure de retour arrière.
