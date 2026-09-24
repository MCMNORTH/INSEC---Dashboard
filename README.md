# INSEC Dashboard

Application de gestion administrative, académique et financière de l’INSEC : admissions, inscriptions, étudiants, enseignants, examens, paiements, documents, communications, alertes, imports/exports Excel, journal d’audit et sauvegardes.

Version 2 : réécriture en **Next.js 16 + PostgreSQL**, conçue pour être hébergée sur **Vercel**. Elle reprend les écrans, les règles métier et les droits d’accès de la version Laravel, avec les mêmes noms de tables pour faciliter la migration des données.

## Pile technique

| Élément | Choix |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Actions), React 19, TypeScript |
| Base de données | PostgreSQL (Neon recommandé), accès via Drizzle ORM |
| Interface | Tailwind CSS 4, Chart.js |
| Documents | PDF avec `@react-pdf/renderer`, Excel avec `exceljs` |
| E-mails | SMTP (Nodemailer), journalisés dans `journal_emails` |
| Fichiers | Bucket S3 privé (Cloudflare R2, Backblaze B2, AWS…) ou table PostgreSQL |
| Tâches planifiées | Vercel Cron (sauvegarde quotidienne) |
| Tests | Vitest (intégration sur PostgreSQL réel) et Playwright (parcours navigateur) |

## Rôles

| Rôle | Accès |
| --- | --- |
| `super_admin` | Tout, y compris les sauvegardes et la restauration |
| `admin` | Administration complète sauf sauvegardes |
| `finance` | Finances et reçus uniquement |
| `enseignant` | Portail enseignant (UE et examens) |
| `etudiant` | Portail étudiant (inscriptions, soldes, examens, résultats) |

Chaque page, action et téléchargement vérifie le rôle côté serveur ; un test automatique (`tests/unit/autorisations.test.ts`) échoue si une action ou une route oublie ce contrôle.

## Déploiement sur Vercel

### 1. Base de données
1. Créez un compte sur [neon.tech](https://neon.tech) puis un projet dans la région **AWS Europe Central (Frankfurt)**.
2. Copiez la chaîne de connexion **pooled** (elle se termine par `?sslmode=require`).

### 2. Stockage des fichiers (recommandé)
Créez un bucket **privé** compatible S3, par exemple sur Cloudflare R2 (10 Go gratuits) :
bucket `insec-fichiers`, puis une clé API avec accès lecture/écriture à ce bucket.
Sans bucket, l’application fonctionne avec `STORAGE_DRIVER=database`, mais les sauvegardes sont alors stockées dans la même base que les données.

### 3. Projet Vercel
1. Sur [vercel.com](https://vercel.com), **Add New → Project** et importez le dépôt GitHub.
2. Dans **Environment Variables**, renseignez au minimum :
   - `DATABASE_URL` : la chaîne Neon ;
   - `AUTH_SECRET` : 48 caractères aléatoires (`openssl rand -base64 48`) ;
   - `CRON_SECRET` : une autre chaîne aléatoire ;
   - `APP_URL` : l’adresse publique, par ex. `https://dashboard.insec.mr` ;
   - pour R2 : `STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_ENDPOINT` (`https://<compte>.r2.cloudflarestorage.com`), `S3_REGION=auto`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` ;
   - pour les e-mails : `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM_ADDRESS`.
   La liste complète est dans `.env.example`.
3. **Deploy**. Le script `vercel-build` applique automatiquement les migrations avant la compilation.
4. Ajoutez votre domaine dans **Settings → Domains**.

La sauvegarde quotidienne est déclarée dans `vercel.json` (02:00 UTC) ; Vercel envoie `CRON_SECRET` automatiquement.

### 4. Données initiales et premier administrateur
Depuis votre poste, avec la même `DATABASE_URL` dans un fichier `.env` :

```bash
npm ci
npm run db:seed                                   # années, DGC/DSGC et leurs UE
npm run admin:create -- --email=direction@insec.mr --name="Direction INSEC"
```

L’inscription publique des comptes internes est désactivée : les autres comptes se créent ensuite dans **Comptes & accès**.

### Reprise des données de la version Laravel
Au lieu de `db:seed`, importez la base SQLite existante (identifiants, mots de passe, reçus et pièces conservés) :

```bash
npm run db:migrate
npm run import:laravel -- --sqlite=/chemin/database/database.sqlite --storage=/chemin/storage/app
```

La base cible doit être vide ; ajoutez `--remplacer` pour la vider d’abord.

## Développement local

Prérequis : Node.js 20.9+ et PostgreSQL 16.

```bash
cp .env.example .env        # renseignez DATABASE_URL et AUTH_SECRET
npm ci
npm run db:migrate && npm run db:seed
npm run admin:create -- --email=vous@exemple.com
npm run dev
```

## Vérifications

```bash
npm run lint
npm run typecheck
npm test            # base de test : TEST_DATABASE_URL (par défaut postgres://postgres@127.0.0.1:5432/insec_test)
npm run build
npm run test:e2e    # base e2e : E2E_DATABASE_URL (par défaut …/insec_e2e), après npm run build
```

Les mêmes contrôles tournent sur GitHub Actions à chaque push et pull request vers `main`.

## Sondes et exploitation

- `GET /health/live` : le processus répond.
- `GET /health/ready` : clé de session, base, stockage et fraîcheur de la dernière sauvegarde. HTTP 503 uniquement si une dépendance critique est défaillante.
- Sauvegardes : **Sauvegardes** (super admin) pour créer, vérifier, télécharger et restaurer. Une archive de précaution est créée avant toute restauration, qui exige le mot de passe et la saisie de `RESTAURER`. Neon conserve en plus son propre historique de restauration.

## Limites connues

- Pièces administratives limitées à **4 Mo** (limite de 4,5 Mo par requête sur Vercel).
- L’import Excel accepte `.xlsx` et `.csv` ; les anciens `.xls` doivent être réenregistrés en `.xlsx`.
- Le plan gratuit Vercel (Hobby) est réservé à un usage personnel et non commercial : un établissement doit utiliser le plan Pro.

## Sécurité

- Mots de passe bcrypt ; sessions signées (cookie httpOnly) révoquées au changement de mot de passe ou à la désactivation du compte.
- Blocage après 5 échecs de connexion ; code de réinitialisation envoyé par e-mail, haché, valable 15 minutes et 5 essais.
- Journal d’audit de toutes les créations, modifications, suppressions, téléchargements, exports et restaurations, sans aucun secret.
- Ne versionnez jamais `.env`, de données réelles d’étudiants, de document administratif ou de sauvegarde.
