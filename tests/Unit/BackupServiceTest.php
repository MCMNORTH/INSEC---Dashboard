<?php

namespace Tests\Unit;

use App\Services\BackupService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use PDO;
use Tests\TestCase;

class BackupServiceTest extends TestCase
{
    private string $database;

    protected function setUp(): void
    {
        parent::setUp();
        $this->database=storage_path('app/backup-service-test.sqlite');
        File::ensureDirectoryExists(dirname($this->database));File::delete($this->database);
        $pdo=new PDO('sqlite:'.$this->database);$pdo->exec('CREATE TABLE controle (id INTEGER PRIMARY KEY, valeur TEXT)');$pdo->exec("INSERT INTO controle (valeur) VALUES ('INSEC')");
        config(['database.default'=>'sqlite','database.connections.sqlite.database'=>$this->database]);DB::purge('sqlite');
        config(['backup.disk' => 'backup-test', 'filesystems.default' => 'documents-test']);
        Storage::fake('backup-test');
        Storage::fake('documents-test');
    }

    protected function tearDown(): void
    {
        DB::purge('sqlite');File::delete($this->database);File::deleteDirectory(storage_path('app/backups'));
        File::deleteDirectory(storage_path('app/backup-cache'));
        File::deleteDirectory(storage_path('app/backup-work'));
        parent::tearDown();
    }

    public function test_archive_is_created_and_verified(): void
    {
        $backup=app(BackupService::class)->creer('Test automatisé');
        $this->assertFileExists($backup['chemin']);$this->assertTrue($backup['integrite']);$this->assertSame('Test automatisé',$backup['motif']);
    }

    public function test_remote_documents_are_encrypted_and_archive_survives_local_cache_loss(): void
    {
        Storage::disk('documents-test')->put('dossiers/42/document.pdf', 'DOCUMENT CONFIDENTIEL');
        $service = app(BackupService::class);
        $backup = $service->creer();
        $this->assertSame(1, $backup['documents']);
        $zip = new \ZipArchive();$zip->open($backup['chemin']);
        $this->assertFalse($zip->getFromName('manifest.json'));
        $zip->setPassword(app(\App\Services\RemoteBackupService::class)->key());
        $this->assertSame('DOCUMENT CONFIDENTIEL', $zip->getFromName('documents/dossiers/42/document.pdf'));
        $zip->close();
        File::delete($backup['chemin']);
        $restored = $service->resoudre($backup['nom']);
        $this->assertTrue($service->inspecter($restored)['integrite']);
        $this->assertCount(1, $service->lister());
    }

    public function test_tampered_remote_archive_is_rejected(): void
    {
        $service = app(BackupService::class);$backup = $service->creer();
        Storage::disk('backup-test')->put('backups/'.$backup['nom'], 'corrupted');
        $this->expectException(\RuntimeException::class);
        $service->resoudre($backup['nom']);
    }

    public function test_wrong_key_and_corrupted_archives_never_pass_verification(): void
    {
        $service = app(BackupService::class);$backup = $service->creer();
        config(['backup.key' => str_repeat('wrong-key', 8)]);
        $this->assertFalse($service->inspecter($backup['chemin'])['integrite']);
        $this->assertEmpty($service->lister());
        File::put($backup['chemin'], 'corrupted');
        $this->assertFalse($service->inspecter($backup['chemin'])['integrite']);
    }

    public function test_retention_always_keeps_latest_backup(): void
    {
        $service = app(BackupService::class);
        $this->travel(-50)->days();$old = $service->creer();
        $this->travel(5)->days();$latest = $service->creer();
        $this->travelBack();
        $this->assertSame(1, $service->purgerAnciens(30));
        Storage::disk('backup-test')->assertMissing('backups/'.$old['nom']);
        Storage::disk('backup-test')->assertExists('backups/'.$latest['nom']);
    }

    public function test_encrypted_sqlite_backup_restores_data_and_documents(): void
    {
        config(['filesystems.default' => 'local']);Storage::fake('local');
        Storage::disk('local')->put('dossiers/1/piece.pdf', 'original');
        $service = app(BackupService::class);$backup = $service->creer();
        DB::table('controle')->update(['valeur' => 'modifié']);
        Storage::disk('local')->put('dossiers/1/piece.pdf', 'modifié');
        $service->restaurer($backup['nom']);
        $this->assertSame('INSEC', DB::table('controle')->value('valeur'));
        $this->assertSame('original', Storage::disk('local')->get('dossiers/1/piece.pdf'));
        $this->assertCount(2, $service->lister());
    }

    public function test_failed_upload_does_not_create_a_success_record(): void
    {
        $repository = \Mockery::mock(\App\Services\RemoteBackupService::class)->makePartial();
        $repository->shouldReceive('enregistrer')->once()->andThrow(new \RuntimeException('Stockage indisponible'));
        $this->app->instance(\App\Services\RemoteBackupService::class, $repository);
        try { app(BackupService::class)->creer(); $this->fail('Une erreur devait être signalée.'); }
        catch (\RuntimeException $e) { $this->assertSame('Stockage indisponible', $e->getMessage()); }
        $this->assertEmpty(Storage::disk('backup-test')->allFiles());
        $this->assertEmpty(File::files(storage_path('app/backup-cache')));
    }

    public function test_postgres_dump_is_packaged_with_correct_engine_metadata(): void
    {
        $connection = \Mockery::mock();$connection->shouldReceive('getDriverName')->andReturn('pgsql');
        DB::shouldReceive('connection')->andReturn($connection);
        DB::shouldReceive('purge')->with('sqlite');
        $dump = \Mockery::mock(\App\Services\PostgresDumpService::class);
        $dump->shouldReceive('creer')->once()->andReturnUsing(fn ($path) => File::put($path, 'PGDMP-test-fixture'));
        $this->app->instance(\App\Services\PostgresDumpService::class, $dump);
        $backup = app(BackupService::class)->creer();
        $this->assertSame('pgsql', $backup['moteur']);
        $this->assertTrue($backup['integrite']);
        $zip = new \ZipArchive();$zip->open($backup['chemin']);
        $zip->setPassword(app(\App\Services\RemoteBackupService::class)->key());
        $this->assertSame('PGDMP-test-fixture', $zip->getFromName('database.dump'));
        $this->assertFalse($zip->getFromName('database.sqlite'));$zip->close();
    }
}
