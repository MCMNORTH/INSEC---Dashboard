# Sauvegardes de production — partie 2

## Périmètre

PostgreSQL : dump natif custom du schéma applicatif public, sans propriétaires ni ACL. Les schémas gérés par Supabase (auth, storage, etc.) ne sont pas restaurés par ce dump. Les fichiers sous dossiers/ sont copiés depuis le disque documentaire Laravel (S3 en production). Le manifeste contient les SHA-256 de la base et de chaque document.

Toutes les entrées ZIP sont chiffrées AES-256. La copie conservée est relue avant publication d’un compte rendu signé. BACKUP_DISK choisit la destination ; par défaut le disque documentaire existant. Préférer à terme un stockage privé indépendant. Une copie locale seule ne survit pas aux redéploiements Render.

BACKUP_KEY doit être conservée dans un gestionnaire de secrets indépendant. Sans configuration explicite, APP_KEY est utilisée. Le mot de passe ZIP est le SHA-256 de la chaîne `insec-backup-v2:` suivie de cette clé. Ne jamais publier la clé ou son dérivé. Conserver l’ancienne clé lors de toute rotation pour pouvoir lire les anciennes archives et leurs comptes rendus. Le mot de passe du compte utilisateur n’est pas le mot de passe ZIP.

## Exécution

Commande serveur : `php artisan insec:backup --verify --retention=30`.

L’interface super-administrateur permet création, vérification et téléchargement. Laravel déclare une exécution à 02:00, mais Render gratuit ne lance PAS l’ordonnanceur et peut dormir. Une planification fiable nécessite un ordonnanceur externe ou un service actif exécutant `php artisan schedule:run` chaque minute. Ne pas annoncer une sauvegarde quotidienne garantie tant que cela n’est pas configuré et vérifié. Une alerte persiste si aucune archive vérifiée de moins de 48 heures n’est conservée.

## Restauration PostgreSQL : sur une base isolée d’abord

1. Télécharger puis déchiffrer l’archive dans un emplacement privé. Vérifier les SHA-256 du manifeste.
2. Créer une base PostgreSQL vide isolée, compatible avec pg_dump. Exécuter `pg_restore --exit-on-error --single-transaction --no-owner --no-acl --dbname=<base-isolée> database.dump`. Fournir les secrets hors de l’historique de commande.
3. Copier documents/dossiers/ vers un bucket privé de test en conservant les chemins dossiers/.
4. Démarrer une instance isolée du même commit. Vérifier étudiants par année, règlements BUMEX, UE, résultats, pièces et PDF. Désactiver tout courriel réel.
5. Consigner date, résultat et durée. Ne basculer la production qu’après autorisation, arrêt des écritures, sauvegarde de précaution et validation de la cible exacte.

La restauration PostgreSQL par bouton est volontairement désactivée. Un contrôle d’archive ne prouve pas une restauration complète. Les tests couvrent SQLite, documents, chiffrement, corruption, perte du cache et rétention. Un exercice PostgreSQL réel reste nécessaire pour valider la reprise.

## Performances

Les données déjà chargées sont réutilisées sur le tableau de bord et dans le dossier financier, réduisant les allers-retours SQL. Aucun cache financier périmable n’est ajouté. La mise en veille de Render gratuit reste une limitation distincte.
