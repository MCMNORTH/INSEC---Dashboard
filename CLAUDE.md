@AGENTS.md

# INSEC Dashboard — guide pour Claude Code

Application de gestion administrative, académique et financière de l’INSEC (Next.js 16 App Router + Server Actions, React 19, TypeScript, PostgreSQL via Drizzle, Tailwind 4). Réécriture de la version Laravel : mêmes noms de tables, mêmes règles métier, mêmes droits. Hébergement Vercel + Neon. Détails complets dans `README.md` et `CONTRIBUTING.md`.

Le code, l’interface, les tests et les commentaires sont **en français** : garder ce vocabulaire (`etudiants`, `inscriptions`, `contexte`, `creer`…) pour tout nouveau code.

## Commandes

```bash
npm run dev            # serveur de développement (port 3000)
npm run lint
npm run typecheck
npm test               # Vitest — nécessite PostgreSQL (TEST_DATABASE_URL, défaut postgres://postgres@127.0.0.1:5432/insec_test)
npm run build
npm run test:e2e       # Playwright — après build ; E2E_DATABASE_URL (défaut …/insec_e2e), port 3100
npm run db:generate    # après toute modification de src/db/schema.ts ; versionner le fichier créé dans drizzle/
npm run db:migrate
npm run db:seed
```

Un seul test : `npx vitest run tests/integration/finances.test.ts` (ou `-t "nom du test"`).
Avant de déclarer une tâche finie : `lint`, `typecheck`, `test` (et `build` si le routage ou la config change). La CI (`.github/workflows/ci.yml`) exécute les mêmes étapes sur Postgres 16.

## Architecture

- `src/db/schema.ts` — schéma Drizzle ; migrations SQL dans `drizzle/`. Ne jamais éditer une migration déjà versionnée : en générer une nouvelle.
- `src/lib/services/` — règles métier, indépendantes de Next.js, prennent un `Ctx` (`src/lib/context.ts`) et sont testées dans `tests/integration/`.
- `src/lib/domain/calculs.ts` — calculs purs (tests unitaires dans `tests/unit/calculs.test.ts`).
- `src/app/(gestion)` — écrans internes (admin, finance) ; `src/app/(portail)` — portails enseignant/étudiant ; `src/app/(public)` — connexion, admission.
- `src/app/**/actions.ts` — Server Actions.
- `src/lib/roles.ts` — rôles `super_admin`, `admin`, `finance`, `enseignant`, `etudiant` et groupes `ADMINS`, `FINANCE`, `SUPER_ADMIN`.
- `src/lib/audit.ts` — `creer`, `modifier`, `supprimer` : toute écriture sur un objet métier passe par eux pour être tracée.
- PDF : `src/pdf/modeles.tsx` + `src/lib/pdf-route.ts` ; Excel : `src/lib/excel-route.ts`, `src/lib/services/excel.ts`.
- Stockage fichiers : `src/lib/storage.ts` (`STORAGE_DRIVER=database|s3`). E-mails : `src/lib/mail.ts`.
- Cron de sauvegarde : `src/app/api/cron` (déclaré dans `vercel.json`).

## Règles impératives

- **Contrôle d’accès côté serveur partout.** Chaque Server Action exportée et chaque route de téléchargement commence par `contexte(ROLES, "route")`, `exigerConnexion()`, `exigerRole(...)`, `reponsePdf(...)` ou `reponseExcel(...)`. `tests/unit/autorisations.test.ts` échoue sinon. Seuls `(public)`, `health` et `api/cron` sont exemptés.
- Toute nouvelle règle métier a au moins un test : comportement attendu **et** accès interdit pour les rôles non autorisés.
- Ne jamais lire, afficher ni versionner `.env`, des données réelles d’étudiants, des documents administratifs ou des sauvegardes. Aucun secret dans le journal d’audit.
- Pièces jointes limitées à 4 Mo (limite Vercel 4,5 Mo/requête).
- Next.js 16 diffère de Next.js 14/15 : consulter `node_modules/next/dist/docs/` avant d’utiliser une API (voir `AGENTS.md`). Par ex. le middleware s’appelle ici `src/proxy.ts`.

## Git

- Branche de travail actuelle : `feature/nextjs-vercel` ; cible des PR : `main` (dépôt `MCMNORTH/INSEC---Dashboard`).
- Messages courts de type Conventional Commits : `feat:`, `fix:`, `test:`, `docs:`, `ci:`.
- Une PR précise l’objectif, les vérifications faites, les risques et la procédure de retour arrière (`.github/pull_request_template.md`).
