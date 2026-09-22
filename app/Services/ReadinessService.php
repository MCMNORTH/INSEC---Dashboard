<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Throwable;

class ReadinessService
{
    public function verifier(): array
    {
        $checks=[];
        $checks['application_key']=$this->check((bool) config('app.key'),'Clé de chiffrement configurée','APP_KEY est absente.');
        $checks['debug']=$this->check(!app()->environment('production')||!config('app.debug'),'Mode debug désactivé en production','APP_DEBUG doit être false en production.');
        try { DB::select('SELECT 1');$checks['database']=$this->check(true,'Connexion à la base disponible',''); }
        catch(Throwable $e){$checks['database']=$this->check(false,'','Base de données indisponible.');}
        if (app()->environment('production') && ($checks['database']['status'] ?? null) === 'ok') {
            $anneeId = DB::table('annees_academiques')->where('libelle', '2024-2025')->value('id');
            $candidatsHistoriques = $anneeId ? DB::table('inscriptions')
                ->where('id_annee_academique', $anneeId)
                ->where('financeur', 'bumex')
                ->count() : 0;
            $checks['historical_candidates'] = $this->check(
                $candidatsHistoriques === 11,
                'Les 11 candidats historiques BUMEX sont présents.',
                "Import historique incomplet ({$candidatsHistoriques}/11)."
            );
        }
        $checks['storage']=$this->check($this->stockageAccessible(),'Stockage accessible en écriture','Le dossier storage/app n’est pas accessible en écriture.');
        $checks['backup']=$this->sauvegardeRecente();
        return ['status'=>collect($checks)->contains(fn($c)=>$c['status']==='failed')?'failed':(collect($checks)->contains(fn($c)=>$c['status']==='warning')?'warning':'ok'),'checks'=>$checks,'checked_at'=>now()->toIso8601String()];
    }

    private function sauvegardeRecente(): array
    {
        $dir=storage_path('app/backups');$fichiers=File::isDirectory($dir)?File::files($dir):[];
        $dernier=collect($fichiers)->filter(fn($f)=>$f->getExtension()==='zip')->sortByDesc(fn($f)=>$f->getMTime())->first();
        if(!$dernier)return ['status'=>'warning','message'=>'Aucune sauvegarde disponible.'];
        $heures=now()->diffInHours(\Illuminate\Support\Carbon::createFromTimestamp($dernier->getMTime()));
        return $heures<=48?['status'=>'ok','message'=>'Dernière sauvegarde récente.']:['status'=>'warning','message'=>'La dernière sauvegarde date de plus de 48 heures.'];
    }

    private function check(bool $ok,string $success,string $failure): array
    { return ['status'=>$ok?'ok':'failed','message'=>$ok?$success:$failure]; }

    private function stockageAccessible(): bool
    {
        $sonde=storage_path('app/.insec-health-'.bin2hex(random_bytes(4)));
        try { File::ensureDirectoryExists(dirname($sonde));return File::put($sonde,'ok')!==false; }
        catch(Throwable $e){return false;}
        finally { File::delete($sonde); }
    }
}
