<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('annees_academiques')) {
            return;
        }

        $maintenant = now();
        foreach (['2024-2025', '2025-2026', '2026-2027'] as $libelle) {
            DB::table('annees_academiques')->updateOrInsert(
                ['libelle' => $libelle],
                ['updated_at' => $maintenant, 'created_at' => $maintenant]
            );
        }

        // L'import précédent avait pu être marqué comme exécuté avant que les
        // années académiques existent en production. Il est idempotent.
        $importHistorique = require database_path('migrations/2026_09_22_000014_import_bumex_dgc_2024_2025.php');
        $importHistorique->up();
    }

    public function down(): void
    {
        // Les années et les dossiers historiques sont des données métier.
    }
};
