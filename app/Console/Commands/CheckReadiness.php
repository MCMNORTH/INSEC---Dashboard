<?php

namespace App\Console\Commands;

use App\Services\ReadinessService;
use Illuminate\Console\Command;

class CheckReadiness extends Command
{
    protected $signature='insec:check';
    protected $description='Contrôle la configuration et les dépendances avant une mise en production';

    public function handle(ReadinessService $service): int
    {
        $resultat=$service->verifier();
        foreach($resultat['checks'] as $nom=>$check){$icone=$check['status']==='ok'?'OK':($check['status']==='warning'?'ATTENTION':'ERREUR');$this->line("[$icone] $nom : {$check['message']}");}
        return $resultat['status']==='failed'?self::FAILURE:self::SUCCESS;
    }
}
