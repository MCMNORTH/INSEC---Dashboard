<?php

use Database\Seeders\FormationSeeder;
use Database\Seeders\UeSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (app()->environment('testing')) {
            return;
        }

        // L'import historique a besoin du catalogue DGC et de ses UE. Ces
        // données n'avaient jamais été seedées dans la base de production.
        (new FormationSeeder())->run();
        (new UeSeeder())->run();

        $importHistorique = require database_path('migrations/2026_09_22_000014_import_bumex_dgc_2024_2025.php');
        $importHistorique->up();

        $anneeId = DB::table('annees_academiques')->where('libelle', '2024-2025')->value('id');
        $nombreCandidats = DB::table('inscriptions')
            ->where('id_annee_academique', $anneeId)
            ->where('financeur', 'bumex')
            ->count();

        if ($nombreCandidats !== 11) {
            throw new \RuntimeException("Import historique incomplet : {$nombreCandidats}/11 candidats BUMEX importés.");
        }
    }

    public function down(): void
    {
        // Les dossiers importés sont des données métier et ne sont pas supprimés.
    }
};
