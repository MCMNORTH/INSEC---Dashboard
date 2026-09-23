<?php
namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;
use ZipArchive;

class BackupService
{
    public function creer(string $motif='Manuelle'): array
    {
        $this->verifierCompatibilite();
        $repository = app(RemoteBackupService::class);
        $password = $repository->key();
        $id = 'insec-'.now()->format('Ymd-His').'-'.bin2hex(random_bytes(6));
        $work = storage_path('app/backup-work/'.$id);
        File::ensureDirectoryExists($work, 0700);
        $archive = storage_path('app/backup-cache/'.$id.'.zip');
        File::ensureDirectoryExists(dirname($archive), 0700);
        $driver = DB::connection()->getDriverName();
        $base = $driver === 'pgsql' ? 'database.dump' : 'database.sqlite';
        $zip = new ZipArchive();
        $opened = false;
        try {
            if ($driver === 'pgsql') app(PostgresDumpService::class)->creer($work.'/'.$base);
            else $this->copierBase($work.'/'.$base);
            $documents = [];
            $disk = Storage::disk(config('filesystems.default'));
            // Includes orphan files too; no student document is silently omitted.
            foreach ($disk->allFiles('dossiers') as $index => $path) {
                if (! $this->cheminDocumentValide($path)) throw new RuntimeException('Chemin de document invalide.');
                $stream = $disk->readStream($path);
                if (! is_resource($stream)) throw new RuntimeException('Document inaccessible : sauvegarde annulée.');
                $local = $work.'/document-'.$index;
                try { File::put($local, $stream); } finally { fclose($stream); }
                $documents[] = ['chemin' => $path, 'taille' => filesize($local), 'sha256' => hash_file('sha256', $local), 'local' => $local];
            }
            if ($zip->open($archive, ZipArchive::CREATE | ZipArchive::EXCL) !== true) throw new RuntimeException('Création archive impossible.');
            $opened = true;
            $zip->setPassword($password);
            $entries = [$base => $work.'/'.$base];
            foreach ($documents as $doc) $entries['documents/'.$doc['chemin']] = $doc['local'];
            foreach ($entries as $entry => $local) {
                if (! $zip->addFile($local, $entry) || ! $zip->setEncryptionName($entry, ZipArchive::EM_AES_256)) {
                    throw new RuntimeException('Chiffrement de sauvegarde indisponible.');
                }
            }
            $manifest = ['version' => 2, 'moteur' => $driver, 'base' => $base,
                'cree_le' => now()->toIso8601String(), 'motif' => $motif,
                'base_sha256' => hash_file('sha256', $work.'/'.$base),
                'documents' => array_map(fn ($d) => array_diff_key($d, ['local' => true]), $documents)];
            if (! $zip->addFromString('manifest.json', json_encode($manifest, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE))
                || ! $zip->setEncryptionName('manifest.json', ZipArchive::EM_AES_256)) throw new RuntimeException('Manifeste non chiffré.');
            if (! $zip->close()) throw new RuntimeException('Finalisation archive impossible.');
            $opened = false;
            $backup = $this->inspecter($archive);
            if (! $backup['integrite']) throw new RuntimeException('Contrôle d’intégrité échoué.');
            $repository->enregistrer($backup);
            return $backup;
        } catch (Throwable $e) {
            if ($opened) { $zip->close(); $opened = false; }
            File::delete($archive);
            throw $e;
        } finally {
            File::deleteDirectory($work);
        }
    }

    public function lister(): array
    {
        $records = app(RemoteBackupService::class)->lister();
        // Old local archives remain visible, but listing is not an integrity verification.
        $known = array_column($records, 'nom');
        foreach (File::files($this->repertoire()) as $file) {
            if ($file->getExtension() === 'zip' && ! in_array($file->getFilename(), $known, true)) {
                $records[] = $this->inspecter($file->getPathname(), false);
            }
        }
        return collect($records)->sortByDesc('cree_le')->values()->all();
    }

    public function inspecter(string $archive, bool $profond=true): array
    {
        $zip = new ZipArchive();
        $manifest = null; $integrite = false; $erreur = null; $opened = false;
        try {
            if ($zip->open($archive) !== true) throw new RuntimeException('Archive illisible.');
            $opened = true;
            $zip->setPassword(app(RemoteBackupService::class)->key());
            $raw = $zip->getFromName('manifest.json');
            $manifest = $raw ? json_decode($raw, true, 512, JSON_THROW_ON_ERROR) : null;
            if (! is_array($manifest) || ! in_array($manifest['base'] ?? '', ['database.sqlite', 'database.dump'], true)) {
                throw new RuntimeException('Manifeste absent ou clé incorrecte.');
            }
            if ($profond) {
                $expected = [$manifest['base'] => $manifest['base_sha256']];
                foreach ($manifest['documents'] ?? [] as $doc) {
                    if (! $this->cheminDocumentValide($doc['chemin'])) throw new RuntimeException('Chemin non autorisé.');
                    $expected['documents/'.$doc['chemin']] = $doc['sha256'];
                }
                foreach ($expected as $entry => $digest) {
                    $stream = $zip->getStream($entry);
                    if (! is_resource($stream)) throw new RuntimeException('Fichier manquant.');
                    try { $hash = hash_init('sha256'); hash_update_stream($hash, $stream); $actual = hash_final($hash); }
                    finally { fclose($stream); }
                    if (! hash_equals($digest, $actual)) throw new RuntimeException('Contenu corrompu.');
                }
                $integrite = true;
            }
        } catch (Throwable $e) { $erreur = 'Archive illisible, corrompue ou clé incorrecte.'; }
        finally { if ($opened) $zip->close(); }
        return ['nom' => basename($archive), 'chemin' => $archive, 'taille' => File::exists($archive) ? File::size($archive) : 0,
            'cree_le' => $manifest['cree_le'] ?? date(DATE_ATOM), 'motif' => $manifest['motif'] ?? 'Inconnu',
            'documents' => count($manifest['documents'] ?? []), 'integrite' => $integrite, 'erreur' => $erreur,
            'moteur' => $manifest['moteur'] ?? 'sqlite'];
    }

    private function cheminDocumentValide(string $path): bool
    {
        return str_starts_with($path, 'dossiers/') && ! str_contains($path, '..')
            && ! str_contains($path, '\\') && ! str_contains($path, ':');
    }

    public function restaurer(string $nom): void
    {
        $this->verifierCompatibilite();
        if (DB::connection()->getDriverName() !== 'sqlite' || config('filesystems.default') !== 'local') {
            throw new RuntimeException('Restauration distante : procédure contrôlée sur une base isolée requise. Aucune donnée modifiée.');
        }
        $archive=$this->resoudre($nom);$controle=$this->inspecter($archive);if(!$controle['integrite'] || $controle['moteur'] !== 'sqlite')throw new RuntimeException('Archive invalide ou corrompue.');
        $cible=config('database.connections.sqlite.database');if($cible===':memory:')throw new RuntimeException('La restauration est impossible sur une base SQLite en mémoire.');
        $zip=new ZipArchive();$zip->open($archive);$zip->setPassword(app(RemoteBackupService::class)->key());$temp=$this->repertoire().'/restore-'.bin2hex(random_bytes(4)).'.sqlite';File::put($temp,$zip->getFromName('database.sqlite'));
        $manifest = json_decode($zip->getFromName('manifest.json'), true, 512, JSON_THROW_ON_ERROR);
        $documents = array_map(fn ($d) => 'documents/'.$d['chemin'], $manifest['documents'] ?? []);$zip->close();
        try {
            $this->creer('Sauvegarde automatique avant restauration');DB::disconnect('sqlite');File::copy($temp,$cible);
            $zip=new ZipArchive();$zip->open($archive);$zip->setPassword(app(RemoteBackupService::class)->key());foreach($documents as $entree){$rel=substr($entree,10);$contenu=$zip->getFromName($entree);if(!Storage::disk('local')->put($rel,$contenu))throw new RuntimeException('Restauration de document impossible.');}$zip->close();
            DB::purge('sqlite');
        } finally { File::delete($temp); }
    }

    public function purgerAnciens(int $jours=30): int
    {
        $repository = app(RemoteBackupService::class);
        $records = $repository->lister();
        $count = 0;
        // Never delete the newest verified archive, even after a prolonged outage.
        foreach (array_slice($records, 1) as $record) {
            if (\Illuminate\Support\Carbon::parse($record['cree_le'])->lt(now()->subDays(max(1, $jours)))) {
                if ($repository->disk()->delete('backups/'.$record['nom'])) {
                    $repository->disk()->delete('backups/'.$record['nom'].'.json');
                    $count++;
                }
            }
        }
        File::ensureDirectoryExists(storage_path('app/backup-cache'), 0700);
        foreach (File::files(storage_path('app/backup-cache')) as $file) {
            if ($file->getMTime() < now()->subDay()->timestamp) File::delete($file->getPathname());
        }
        return $count;
    }

    public function resoudre(string $nom): string
    {
        if (basename($nom) !== $nom || ! preg_match('/^insec-[A-Za-z0-9-]+\\.zip$/', $nom)) abort(404);
        if (collect(app(RemoteBackupService::class)->lister())->contains('nom', $nom)) return app(RemoteBackupService::class)->resoudre($nom);
        $path = $this->repertoire().'/'.$nom;
        abort_unless(File::exists($path), 404);
        return $path;
    }
    private function copierBase(string $destination): void
    { $quoted=str_replace("'","''",$destination);DB::statement("VACUUM INTO '{$quoted}'"); }
    private function documents(): array
    { $root=storage_path('app/dossiers');if(!File::isDirectory($root))return [];return collect(File::allFiles($root))->map(fn($f)=>['chemin'=>str_replace('\\','/',$f->getRelativePathname()) ? 'dossiers/'.str_replace('\\','/',$f->getRelativePathname()) : '', 'taille'=>$f->getSize(),'sha256'=>hash_file('sha256',$f->getPathname())])->all(); }
    private function repertoire(): string { $dir=storage_path('app/backups');File::ensureDirectoryExists($dir);return $dir; }
    private function verifierCompatibilite(): void
    { if(!in_array(DB::connection()->getDriverName(), ['sqlite', 'pgsql'], true))throw new RuntimeException('Moteur de sauvegarde non pris en charge.');if(!class_exists(ZipArchive::class))throw new RuntimeException('L’extension PHP Zip est requise.'); }
}
