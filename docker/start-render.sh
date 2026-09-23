#!/usr/bin/env bash
set -euo pipefail

port="${PORT:-10000}"
export SESSION_DRIVER=cookie
sed -i "s/Listen 80/Listen ${port}/" /etc/apache2/ports.conf
sed -i "s/<VirtualHost \*:10000>/<VirtualHost *:${port}>/" /etc/apache2/sites-available/000-default.conf

mkdir -p storage/framework/{cache,sessions,views} storage/logs bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache

php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache

exec apache2-foreground
