# INSEC Dashboard — guide pour Claude Code

Réponds toujours en **français**, simplement et clairement. Le code, l’interface, les commentaires et les messages de commit sont aussi en français (garder le vocabulaire existant : `etudiants`, `inscriptions`, `versements`, `examens`…).

## Contexte métier

- **INSEC** (Nouakchott, Mauritanie) est **centre associé de l’INTEC – CNAM Paris**. L’INSEC inscrit les étudiants mauritaniens aux diplômes de l’INTEC et organise leurs examens sur place.
- Diplômes préparés :
  - **DGC** — Diplôme de gestion et de comptabilité : **13 UE** ;
  - **DSGC** — Diplôme supérieur de gestion et de comptabilité : **7 UE**.
- **UE** = unité d’enseignement. Un étudiant s’inscrit chaque **année scolaire** à une ou plusieurs UE ; les tarifs sont fixés par UE et diffèrent entre DGC et DSGC (tarif INTEC + tarif INSEC).
- **Années scolaires** : format `AAAA-AAAA` (ex. `2026-2027`). Années visibles : `2024-2025` à `2027-2028` ; année par défaut : `2026-2027` (`functions/src/shared/domaine.ts`).
- **Monnaie** : ouguiya mauritanien, **MRU**. Les frais INTEC sont en euros ; le taux EUR/MRU est un réglage audité.
- **Financement BUMEX** : certains étudiants sont financés par BUMEX ; ce financement est distinct des créances étudiantes.
- **Fuseaux horaires — point critique** :
  - les **examens INTEC sont fixés à l’heure de Paris** (`Europe/Paris` : UTC+1 en hiver, UTC+2 en été) ;
  - **Nouakchott est en UTC+0** toute l’année, sans heure d’été (`Africa/Nouakchott`).
  - Une épreuve à 14 h (Paris) se passe donc à 13 h à Nouakchott en hiver et à 12 h en été. Toujours afficher le fuseau à côté d’une heure d’examen, et ne jamais stocker une heure sans fuseau.
- Calendrier officiel INTEC : importé depuis le PDF officiel (`/examens/importer-calendrier`).
- Les données des étudiants (identité, contacts, résultats, paiements, pièces) sont **personnelles** : voir les règles ci-dessous.

## Architecture (version officielle : Vue 3 + Firebase)

L’ancienne version Laravel est archivée par le tag `laravel-archive` ; les travaux abandonnés par les tags `archive/*`. Ne plus les modifier.

| Besoin | Technologie |
| --- | --- |
| Interface | Vue 3 + TypeScript + Tailwind 4 + Vite (`src/`), SPA servie par **Firebase Hosting** |
| Comptes | **Firebase Authentication** ; rôles portés par des *custom claims* : `super_admin`, `admin`, `finance`, `enseignant`, `etudiant` |
| Données | **Cloud Firestore** ; lecture directe protégée par `firestore.rules` |
| Fichiers | **Cloud Storage** (`storage.rules`) |
| Règles métier, PDF, Excel, e-mails, audit | **Cloud Functions** 2ᵉ génération, Node.js 22, région **`europe-west1`** (`functions/src/`) |
| Sauvegardes | export Firestore géré quotidien (Cloud Scheduler) |

- Projet Firebase de production : **`insec-bd390`** (`.firebaserc`, alias `default`). Projet local des émulateurs : `demo-insec`.
- Site en ligne : https://insec-bd390.web.app
- **Écritures** : uniquement via des fonctions appelables (`functions/src/handlers/*.ts`), qui valident (zod), appliquent les règles dans une transaction et écrivent le **journal d’audit** dans la même transaction. Pas d’écriture directe depuis le navigateur.
- **Règles partagées** front/back : `functions/src/shared/domaine.ts` (importé côté Vue via l’alias `@shared`). Les calculs financiers doivent rester à cet endroit, testés.
- Routes de l’interface : `src/router.ts` ; vues : `src/vues/` ; composants : `src/composants/`.

## Commandes

Prérequis : Node.js 22+, Java 21+ (émulateurs), Firebase CLI (`npm install -g firebase-tools`).

```bash
npm install
npm --prefix functions install

npm run dev                          # interface sur http://localhost:5173
npm run emulateurs                   # émulateurs Auth, Firestore, Storage, Functions (UI : http://127.0.0.1:4000)
npm run amorcer:local                # référentiel + comptes de démonstration (émulateurs uniquement)

npm run build                        # vérification des types + compilation de l’interface
npm --prefix functions run typecheck
npm --prefix functions run build
npm --prefix functions test          # tests des fonctions et des règles, sur émulateurs (Java requis)
```

La CI (`.github/workflows/ci.yml`) exécute ces mêmes étapes sur chaque PR vers `main` : jobs « Firebase · Functions et règles » et « Front-end · Node.js 24 ».

### Déploiement

```bash
firebase deploy --project insec-bd390
```

- **Ne jamais lancer `firebase deploy` sans l’accord explicite de l’utilisateur**, et uniquement depuis `main` à jour, après CI verte.
- Avant de déployer : dire ce qui va changer par rapport à la version en ligne (comparer avec le bundle `/assets/index-*.js` du site).

## Règles de travail

- **Jamais de push direct sur `main`.** Toute modification passe par une branche (`feat/…`, `fix/…`, `docs/…`) et une **PR** fusionnée seulement quand la **CI est verte** (protection de `main`). Le projet est mené par une seule personne : aucune approbation tierce n’est exigée, mais chaque PR est relue (par l’utilisateur ou par Claude) avant fusion, avec un résumé clair des changements.
- `main` est la seule branche durable. Supprimer les branches de travail après fusion.
- Une PR = un sujet. Messages de commit courts de type Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `ci:`).
- Toute nouvelle règle métier ou correction de calcul a au moins un test (comportement attendu **et** refus pour les rôles non autorisés).
- **Aucun secret dans le code** : pas de mot de passe, clé API privée, mot de passe SMTP, jeton. Les paramètres vont dans `functions/.env.<projet>` (non versionné) et les secrets dans Secret Manager (`firebase functions:secrets:set`).
- **Données personnelles des étudiants protégées** :
  - ne jamais versionner, afficher dans un log, copier dans une issue/PR ou envoyer à un service externe des données réelles (identités, e-mails, téléphones, notes, paiements, pièces, sauvegardes) ;
  - utiliser uniquement des données fictives (émulateurs, `amorcer:local`) pour le développement et les tests ;
  - ne jamais saisir les identifiants de l’utilisateur sur le site en ligne.
- Ne pas modifier `firestore.rules`, `storage.rules` ou les rôles sans test dédié dans `functions/test/regles.test.ts`.
- Demander confirmation avant toute action irréversible ou visible : push, fusion, suppression de branche, changement de protection GitHub, tag poussé, déploiement.

## Procédures INTEC à respecter

> Section à compléter par l’utilisateur. Exemples de points à préciser :

- Calendrier d’inscription INTEC (dates limites, pièces exigées) : _à compléter_
- Règles de tarification par UE (INTEC / INSEC) et modalités de paiement : _à compléter_
- Organisation des examens : réception des sujets, convocations, feuilles de présence, surveillance, retour des copies à l’INTEC (délais, bordereau) : _à compléter_
- Publication des résultats et diffusion aux étudiants : _à compléter_
- Convention INTEC – INSEC (renouvellement, obligations) : _à compléter_
- Conservation et protection des données personnelles : _à compléter_
