<?php

namespace Tests\Unit;

use App\Services\BackupService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
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
    }

    protected function tearDown(): void
    {
        DB::purge('sqlite');File::delete($this->database);File::deleteDirectory(storage_path('app/backups'));
        parent::tearDown();
    }

    public function test_archive_is_created_and_verified(): void
    {
        $backup=app(BackupService::class)->creer('Test automatisé');
        $this->assertFileExists($backup['chemin']);$this->assertTrue($backup['integrite']);$this->assertSame('Test automatisé',$backup['motif']);
    }
}
