<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Schema; 
use App\Observers\AuditObserver;
use App\Models\{AffectationEnseignant, Candidature, Echeance, Enseignant, Etudiant, Examen, Formation, Inscription, PieceAdministrative, ResultatExamen, Ue, User, Versement};

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Schema::defaultStringLength(191); 
        foreach ([User::class, Etudiant::class, Enseignant::class, Formation::class, Ue::class, Inscription::class, Versement::class, Echeance::class, Examen::class, ResultatExamen::class, PieceAdministrative::class, Candidature::class, AffectationEnseignant::class] as $model) {
            $model::observe(AuditObserver::class);
        }
    }
}
