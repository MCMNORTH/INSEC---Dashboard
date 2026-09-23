<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\File;
use RuntimeException;

class RemoteBackupService
{
    public function disk()
    {
        return Storage::disk(config('backup.disk', 'local'));
    }

    public function key(): string
    {
        $secret = config('backup.key');
        if (! is_string($secret) || strlen($secret) < 16) {
            throw new RuntimeException('Une clé de sauvegarde forte est requise.');
        }
        return hash('sha256', 'insec-backup-v2:'.$secret);
    }

    public function enregistrer(array $backup): void
    {
        $stream = fopen($backup['chemin'], 'rb');
        try {
            if (! $this->disk()->put('backups/'.$backup['nom'], $stream, ['visibility' => 'private'])) {
                throw new RuntimeException('Échec de conservation de la sauvegarde.');
            }
        } finally { fclose($stream); }
        // Verify persisted bytes, not just the local archive, before publishing a success record.
        $read = $this->disk()->readStream('backups/'.$backup['nom']);
        if (! is_resource($read)) throw new RuntimeException('Sauvegarde distante illisible.');
        try {
            $hash = hash_init('sha256');
            hash_update_stream($hash, $read);
            $digest = hash_final($hash);
        } finally { fclose($read); }
        if (! hash_equals(hash_file('sha256', $backup['chemin']), $digest)) {
            throw new RuntimeException('La copie conservée ne correspond pas à l’archive vérifiée.');
        }
        unset($backup['chemin']);
        $backup['sha256'] = $digest;
        $payload = json_encode($backup, JSON_THROW_ON_ERROR);
        $record = json_encode(['payload' => $payload, 'signature' => hash_hmac('sha256', $payload, $this->key())], JSON_THROW_ON_ERROR);
        if (! $this->disk()->put('backups/'.$backup['nom'].'.json', $record, ['visibility' => 'private'])) {
            throw new RuntimeException('Impossible de conserver le contrôle de sauvegarde.');
        }
    }

    public function lister(): array
    {
        $records = [];
        foreach ($this->disk()->files('backups') as $path) {
            if (! preg_match('~^backups/(insec-[A-Za-z0-9-]+\.zip)\.json$~', $path, $m)) continue;
            $record = json_decode($this->disk()->get($path), true);
            if (! is_array($record) || ! isset($record['payload'], $record['signature'])) continue;
            if (! hash_equals(hash_hmac('sha256', $record['payload'], $this->key()), $record['signature'])) continue;
            $backup = json_decode($record['payload'], true);
            if (! is_array($backup) || ($backup['nom'] ?? '') !== $m[1] || ! $this->disk()->exists('backups/'.$m[1])) continue;
            $records[] = $backup;
        }
        return collect($records)->sortByDesc('cree_le')->values()->all();
    }

    public function resoudre(string $nom): string
    {
        abort_unless(preg_match('/^insec-[A-Za-z0-9-]+\.zip$/', $nom), 404);
        $record = collect($this->lister())->firstWhere('nom', $nom);
        abort_unless($record, 404);
        $dir = storage_path('app/backup-cache');
        File::ensureDirectoryExists($dir, 0700);
        $target = $dir.'/'.$nom;
        $stream = $this->disk()->readStream('backups/'.$nom);
        if (! is_resource($stream)) throw new RuntimeException('Sauvegarde illisible.');
        try { File::put($target, $stream); } finally { fclose($stream); }
        if (! hash_equals($record['sha256'], hash_file('sha256', $target))) {
            File::delete($target);
            throw new RuntimeException('Archive corrompue.');
        }
        return $target;
    }
}
