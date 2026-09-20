<?php
namespace App\Observers;
use App\Services\AuditService;
use Illuminate\Database\Eloquent\Model;
class AuditObserver
{
    public function created(Model $model): void { AuditService::modele($model,'created',[],AuditService::nettoyer($model->getAttributes())); }
    public function updated(Model $model): void { $changes=$model->getChanges();$avant=[];foreach(array_keys($changes) as $key)$avant[$key]=$model->getOriginal($key);AuditService::modele($model,'updated',AuditService::nettoyer($avant),AuditService::nettoyer($changes)); }
    public function deleted(Model $model): void { AuditService::modele($model,'deleted',AuditService::nettoyer($model->getAttributes()),[]); }
}
