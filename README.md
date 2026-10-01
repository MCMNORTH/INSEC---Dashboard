# INSEC Dashboard

Application de gestion administrative, académique et financière de l’INSEC : admissions, inscriptions, étudiants, enseignants, examens, paiements, documents, communications, alertes, imports/exports, audit et sauvegardes.

L’application fonctionne entièrement sur **Firebase** :

| Besoin | Service Firebase |
| --- | --- |
| Interface (Vue 3 + Tailwind, SPA) | Firebase Hosting |
| Comptes, connexion, réinitialisation du mot de passe | Firebase Authentication (rôles portés par des *custom claims*) |
| Données | Cloud Firestore (lecture directe, protégée par `firestore.rules`) |
| Pièces administratives | Cloud Storage (`storage.rules`) |
| Règles métier, PDF, Excel, e-mails, audit | Cloud Functions 2ᵉ génération (Node.js 22, région `europe-west1`) |
| Sauvegarde quotidienne à 02:00 | Cloud Scheduler + export Firestore géré |
| Sondes `/health/live` et `/health/ready` | Hosting → fonction `sante` |

Le schéma relationnel d’origine est conservé dans `docs/schema_relationnel_INSEC.png` à titre historique.

## Architecture

- **Lectures** : le navigateur lit Firestore en temps réel ; les règles limitent chaque rôle à ses données (un étudiant ne voit que son dossier, la finance n’accède ni au journal d’audit ni aux résultats, etc.).
- **Écritures** : toutes passent par des fonctions appelables (`functions/src/handlers`) qui valident les données, appliquent les règles métier dans une transaction et ajoutent l’entrée du **journal d’audit** dans la même transaction. Aucune écriture directe n’est autorisée depuis le navigateur, sauf le marquage lu/archivé de ses propres alertes.
- **Règles partagées** : les calculs financiers et académiques (`functions/src/shared/domaine.ts`) sont utilisés à la fois par les fonctions et par l’interface.
- **E-mails** : les opérations ajoutent un document à `journalEmails` ; le déclencheur `envoyerEmail` l’expédie par SMTP et met à jour son statut (`Envoyé` / `Échec`), visible dans *Communications*.
- **Unicité et numérotation** : les contraintes d’unicité (e-mail étudiant, candidature par année…) utilisent la collection technique `uniques` ; les numéros de reçu (`REC-AAAAMM-000001`) et de convocation, la collection `compteurs`.

## Développement local

Prérequis : Node.js 22+, Java 21+ (émulateurs), Firebase CLI (`npm install -g firebase-tools`).

```bash
npm install
npm --prefix functions install

# Terminal 1 : émulateurs Auth, Firestore, Storage, Functions (données remises à zéro à chaque démarrage)
npm run emulateurs

# Terminal 2 : référentiel, super-administrateur et comptes de démonstration
npm run amorcer:local
npm run dev            # http://localhost:5173
```

Comptes créés par `amorcer:local` (émulateurs uniquement) :

| Rôle | E-mail | Mot de passe |
| --- | --- | --- |
| Super-administrateur | `superadmin@insec.test` | `insec-super-2026` |
| Administrateur | `admin@insec.test` | `insec-demo-2026` |
| Finance | `finance@insec.test` | `insec-demo-2026` |
| Enseignant | `enseignant@insec.test` | `insec-demo-2026` |
| Étudiant | `etudiant@insec.test` | `insec-demo-2026` |

En local, les e-mails sont simulés (journalisés comme envoyés) et l’interface Emulator UI est disponible sur http://127.0.0.1:4000.

### Tests

```bash
npm test                         # fonctions + règles Firestore/Storage, sur émulateurs
npm --prefix functions run typecheck
npm run build                    # vérification des types et compilation de l’interface
```

## Mise en production

1. Créez le projet Firebase et passez-le au forfait **Blaze** (requis pour Cloud Functions et Cloud Scheduler). Activez Authentication (fournisseur *E-mail/Mot de passe*), Firestore (mode natif, région `eur3` ou `europe-west1`) et Storage.
2. Associez le dépôt au projet : `firebase use --add` (alias `default`).
3. Configurez les paramètres : copiez `functions/.env.example` en `functions/.env.<id-du-projet>` et complétez-le, puis enregistrez le secret SMTP :
   ```bash
   firebase functions:secrets:set SMTP_PASSWORD
   ```
4. Préparez les sauvegardes avant le déploiement : créez le bucket `<projet>-sauvegardes` (ou celui indiqué dans `BACKUP_BUCKET`) dans la même région que Firestore (`europe-west1` pour `insec-bd390`). Le code purge les archives après 30 jours ; ajoutez une règle de cycle de vie de secours à 35 jours et activez la *suppression réversible* (soft delete). Les exports gérés s’exécutent avec le compte de service Firestore affiché dans **Firestore → Importations/Exportations** ; dans le même projet, ce compte dispose normalement de l’accès requis au bucket. Le compte d’exécution des fonctions doit pouvoir lancer les exports (rôle **Cloud Datastore Import Export Admin** sur le projet) et gérer les objets du bucket pour copier, vérifier et purger les pièces jointes (rôle **Storage Object Admin** sur le bucket). Vérifiez le compte d’exécution réel dans les paramètres de sécurité de la fonction avant de lui accorder ces rôles ; ne donnez pas `Storage Admin` au niveau du projet.
5. Déployez :
   ```bash
   firebase deploy
   ```
   Le déploiement compile l’interface et les fonctions, publie les règles et crée les index. La création des index composites peut prendre quelques minutes.
6. Créez le premier super-administrateur (l’inscription publique des comptes internes n’existe pas) avec des identifiants Google Cloud autorisés (`gcloud auth application-default login`) :
   ```bash
   GCLOUD_PROJECT=<id-du-projet> SUPER_ADMIN_EMAIL=… SUPER_ADMIN_NOM="…" SUPER_ADMIN_MOT_DE_PASSE=… npm --prefix functions run amorcer
   ```
   Le script charge aussi le référentiel INTEC-CNAM (diplômes DGC/DSGC, UE, années académiques). Il peut être relancé sans risque.
7. Dans la console Authentication, personnalisez en français le modèle d’e-mail de réinitialisation du mot de passe et ajoutez votre domaine aux domaines autorisés.

### Vérifications après déploiement

- `GET /health/live` : le service répond.
- `GET /health/ready` : contrôle Firestore, Cloud Storage et l’existence d’une sauvegarde de moins de 48 heures. Renvoie HTTP 503 uniquement si Firestore ou Storage est indisponible ; l’absence de sauvegarde récente est un simple avertissement.
- Connexion avec chaque rôle, puis création d’une sauvegarde manuelle depuis *Sauvegardes*.

## Sauvegarde et restauration

- Une sauvegarde est créée chaque jour à 02:00 (heure de Nouakchott) : export Firestore géré + copie des pièces de `dossiers/`, avec contrôle d’intégrité (MD5). Les sauvegardes de plus de 30 jours sont purgées.
- La restauration est réservée au super-administrateur : elle exige la saisie de son mot de passe (ré-authentification de moins de 5 minutes) et la confirmation `RESTAURER`. Une sauvegarde de précaution est créée automatiquement avant l’import.
- L’import Firestore remplace les documents présents dans la sauvegarde mais **ne supprime pas** ceux créés depuis. Pour un retour exact à un état antérieur, restaurez dans un projet vide.
- Testez périodiquement une restauration dans un projet Firebase distinct.

## Sécurité

- Ne versionnez jamais de secret, de document étudiant ou de sauvegarde. Les paramètres non secrets de production vont dans `functions/.env.<projet>` (non versionné), le mot de passe SMTP dans Secret Manager.
- Un compte désactivé perd immédiatement l’accès aux opérations et est déconnecté de l’interface ; ses jetons de lecture expirent au plus tard dans l’heure.
- Le formulaire public de préinscription est exposé sans authentification : activez **App Check** (reCAPTCHA Enterprise) avant l’ouverture au public si des abus sont constatés.
- Consultez régulièrement le journal d’audit.

## Limites connues

- La recherche d’étudiants et la pagination des listes se font côté navigateur, ce qui convient à quelques milliers de dossiers ; au-delà, prévoir un index de recherche dédié.
- L’import Excel accepte les formats `.xlsx` et `.csv` (l’ancien format `.xls` n’est plus pris en charge).
