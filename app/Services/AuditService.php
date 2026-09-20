<?php
namespace App\Services;
use App\Models\JournalAudit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;
class AuditService
{
    private const SENSIBLES=['password','remember_token','two_factor_secret','two_factor_recovery_codes','api_token'];
    public static function modele(Model $model,string $action,array $avant=[],array $apres=[]): void
    {
        self::enregistrer($action,class_basename($model),(string)$model->getKey(),self::libelle($model,$action),$avant,$apres);
    }
    public static function manuel(string $action,string $description,?Model $model=null,array $details=[]): void
    {
        self::enregistrer($action,$model?class_basename($model):null,$model?(string)$model->getKey():null,$description,[],self::nettoyer($details));
    }
    private static function enregistrer(string $action,?string $modele,?string $id,string $description,array $avant,array $apres): void
    {
        if(!Schema::hasTable('journal_audit'))return;$request=request();$user=auth()->user();
        JournalAudit::create(['user_id'=>$user?->id,'acteur'=>$user?->name,'action'=>$action,'modele'=>$modele,'modele_id'=>$id,'description'=>$description,'avant'=>self::nettoyer($avant)?:null,'apres'=>self::nettoyer($apres)?:null,'adresse_ip'=>$request?->ip(),'user_agent'=>mb_substr((string)$request?->userAgent(),0,1000),'route'=>$request?->route()?->getName()]);
    }
    public static function nettoyer(array $donnees): array
    { return collect($donnees)->except(array_merge(self::SENSIBLES,['created_at','updated_at']))->map(fn($v)=>$v instanceof \DateTimeInterface?$v->format(DATE_ATOM):$v)->all(); }
    private static function libelle(Model $m,string $action): string
    { $nom=class_basename($m);$labels=['created'=>'Création','updated'=>'Modification','deleted'=>'Suppression'];return ($labels[$action]??ucfirst($action)).' '.$nom.' #'.$m->getKey(); }
}
