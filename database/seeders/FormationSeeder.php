<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Formation;

class FormationSeeder extends Seeder
{
    public function run(): void
    {
        $formations = [
            ['nom' => 'DGC', 'libelle' => 'Diplôme de Gestion Comptable'],
            ['nom' => 'DSGC', 'libelle' => 'Diplôme Supérieur de Gestion Comptable'],
        ];

        foreach ($formations as $formation) {
            Formation::firstOrCreate(['nom' => $formation['nom']], $formation);
        }
    }
}