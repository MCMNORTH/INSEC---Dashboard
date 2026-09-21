# INSEC Dashboard

Application de gestion administrative, académique et financière de l’INSEC. Elle couvre les admissions, inscriptions, étudiants, enseignants, examens, paiements, documents, communications, alertes, imports/exports, audit et sauvegardes.

## Prérequis

- PHP 8.2 ou supérieur avec PDO SQLite, Zip, Mbstring, OpenSSL et Fileinfo.
- Composer 2.
- Node.js 20 ou supérieur et npm.
- Un serveur web dont la racine publique pointe vers `public/`.

## Installation

```bash
composer install --no-dev --optimize-autoloader
cp .env.example .env
php artisan key:generate
php artisan migrate --force
npm ci
npm run build
php artisan storage:link
php artisan optimize
```

Créez ensuite le premier super-administrateur de manière contrôlée. L’inscription publique des comptes internes est désactivée.

## Vérifications avant déploiement

```bash
php artisan insec:check
php artisan test
```

Les sondes destinées au serveur ou au service de supervision sont :

- `GET /health/live` : confirme que le processus HTTP répond.
- `GET /health/ready` : contrôle la clé applicative, le mode debug, la base, le stockage et l’existence d’une sauvegarde récente.

La sonde de disponibilité renvoie HTTP 503 uniquement lorsqu’une dépendance critique est défaillante. L’absence d’une sauvegarde récente est signalée comme avertissement sans couper le trafic.

## Tâches planifiées

Le planificateur Laravel doit être exécuté chaque minute par le serveur :

```cron
* * * * * cd /chemin/vers/insec-dashboard && php artisan schedule:run >> /dev/null 2>&1
```

Une archive vérifiée est créée chaque jour à 02:00 et les sauvegardes de plus de 30 jours sont supprimées. Pour une sauvegarde manuelle :

```bash
php artisan insec:backup --verify --retention=30
```

Les archives se trouvent dans `storage/app/backups`. Elles doivent également être copiées vers un stockage externe protégé afin de couvrir la perte complète du serveur.

## Déploiement et reprise

1. Activez le mode maintenance avec `php artisan down --retry=60`.
2. Créez une sauvegarde vérifiée.
3. Déployez le code et exécutez `php artisan migrate --force`.
4. Exécutez `npm run build`, `php artisan optimize` et `php artisan insec:check`.
5. Désactivez le mode maintenance avec `php artisan up`.
6. Contrôlez `/health/ready`, la connexion et les fonctions principales.

La restauration depuis l’interface est réservée au super-administrateur et exige son mot de passe ainsi que la confirmation `RESTAURER`. Une sauvegarde de précaution est créée automatiquement avant toute restauration.

## Sécurité

- En production : `APP_ENV=production`, `APP_DEBUG=false` et HTTPS obligatoire.
- Ne versionnez jamais `.env`, les bases SQLite, les sauvegardes ou les documents utilisateurs.
- Protégez en écriture `storage/` et `bootstrap/cache/`, sans rendre leur contenu directement public.
- Faites tourner les identifiants SMTP et autres secrets en cas d’exposition.
- Consultez régulièrement le journal d’audit et testez périodiquement une restauration sur un environnement isolé.
