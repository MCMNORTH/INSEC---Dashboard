<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use RuntimeException;
use Symfony\Component\Process\Process;

class PostgresDumpService
{
    public function creer(string $destination): void
    {
        // getConfig resolves DATABASE_URL; never put credentials into command arguments or logs.
        $config = DB::connection()->getConfig();
        $process = new Process([
            config('backup.pg_dump'), '--format=custom', '--no-owner', '--no-acl',
            '--schema=public', '--no-password', '--file='.$destination,
        ], null, [
            'PGHOST' => (string) $config['host'], 'PGPORT' => (string) ($config['port'] ?? 5432),
            'PGDATABASE' => (string) $config['database'], 'PGUSER' => (string) $config['username'],
            'PGPASSWORD' => (string) $config['password'], 'PGSSLMODE' => (string) ($config['sslmode'] ?? 'require'),
            'PGCONNECT_TIMEOUT' => '15',
        ], null, config('backup.timeout', 300));
        try {
            $process->run();
            if (! $process->isSuccessful() || ! is_file($destination) || filesize($destination) === 0) {
                throw new RuntimeException('Dump absent.');
            }
        } catch (\Throwable $e) {
            // Process exceptions may include connection details: deliberately do not forward them.
            throw new RuntimeException('Sauvegarde PostgreSQL impossible : vérifier pg_dump, sa version et la connexion au serveur.');
        }
    }
}
