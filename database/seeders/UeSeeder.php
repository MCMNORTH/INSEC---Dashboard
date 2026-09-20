<?php

namespace Database\Seeders;

use App\Models\Formation;
use App\Models\Ue;
use Illuminate\Database\Seeder;

class UeSeeder extends Seeder
{
    public function run(): void
    {
        $catalogue = [
            'DGC' => [
                ['TEC111', 'Fondamentaux du droit', 14, 1],
                ['TEC115', 'Économie contemporaine', 14, 1],
                ['TEC118', "Système d'information de gestion", 14, 1],
                ['TEC119', 'Comptabilité', 14, 1],
                ['TEC112', 'Droit des sociétés et des groupements d’affaires', 14, 2],
                ['TEC116', "Finance d'entreprise", 14, 2],
                ['TEC117', 'Management', 14, 2],
                ['TEC122', 'Anglais des affaires', 14, 2],
                ['TEC113', 'Droit social', 14, 3],
                ['TEC114', 'Droit fiscal', 14, 3],
                ['TEC120', 'Comptabilité approfondie', 14, 3],
                ['TEC121', 'Contrôle de gestion', 14, 3],
                ['TEC123', 'Communication professionnelle', 12, 3],
            ],
            'DSGC' => [
                ['TEC211', 'Gestion juridique, fiscale et sociale', 20, 1],
                ['TEC212', 'Finance', 15, 1],
                ['TEC213', 'Contrôle de gestion et stratégie', 20, 1],
                ['TEC214', 'Comptabilité et audit', 20, 2],
                ['TEC215', "Management des systèmes d'information", 15, 2],
                ['TEC217', 'Mémoire professionnel', 15, 2],
                ['TEC218', 'Anglais des affaires', 15, 2],
            ],
        ];

        foreach ($catalogue as $codeFormation => $ues) {
            $formation = Formation::where('code', $codeFormation)->firstOrFail();

            foreach ($ues as $index => [$code, $libelle, $credits, $annee]) {
                Ue::updateOrCreate(
                    ['code' => $code],
                    [
                        'formation_id' => $formation->id,
                        'libelle' => $libelle,
                        'credits' => $credits,
                        'annee_parcours' => $annee,
                        'ordre' => $index + 1,
                        'active' => true,
                    ]
                );
            }
        }
    }
}
