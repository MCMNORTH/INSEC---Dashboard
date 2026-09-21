<?php
namespace App\Console\Commands;
use App\Services\BackupService;
use Illuminate\Console\Command;
class CreateBackup extends Command
{
    protected $signature='insec:backup {--verify : Contrôler l’archive après création} {--retention=30 : Nombre de jours de conservation}';
    protected $description='Crée une sauvegarde complète de l’INSEC Dashboard';
    public function handle(BackupService $service): int { try { $backup=$service->creer('Planifiée'); if($this->option('verify')&&!$service->inspecter($backup['chemin'])['integrite']){$this->error('Contrôle d’intégrité échoué.');return self::FAILURE;} $supprimes=$service->purgerAnciens((int)$this->option('retention'));$this->info('Sauvegarde créée : '.$backup['nom']);if($supprimes)$this->line($supprimes.' ancienne(s) sauvegarde(s) supprimée(s).');return self::SUCCESS; } catch(\Throwable $e){$this->error($e->getMessage());return self::FAILURE;} }
}
